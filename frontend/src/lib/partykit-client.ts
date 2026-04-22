/**
 * MindPulse — PartyKit Serverless WebSocket Client
 * ===================================================
 * Replaces self-managed WebSocket with PartyKit's serverless infrastructure.
 * 
 * Features:
 * - Automatic reconnection
 * - Presence detection (who's online)
 * - Serverless (no WebSocket server to manage)
 * - $0.10 per million messages
 * 
 * Use cases:
 * - Real-time stress score streaming
 * - Team wellness dashboard (future)
 * - Collaborative features (future)
 * 
 * Usage:
 *   import { partyKitClient } from '@/lib/partykit-client';
 *   
 *   // Connect
 *   await partyKitClient.connect(userId);
 *   
 *   // Listen for stress updates
 *   partyKitClient.onStressUpdate((data) => {
 *     console.log('Stress score:', data.score);
 *   });
 *   
 *   // Send data
 *   partyKitClient.sendStressData({ score: 45, level: 'MILD' });
 */

import PartySocket from "partysocket";

interface StressData {
  score: number;
  level: string;
  confidence: number;
  timestamp: number;
}

interface PartyMessage {
  type: string;
  data: unknown;
  userId?: string;
  timestamp: number;
}

class PartyKitClient {
  private socket: PartySocket | null = null;
  private userId: string | null = null;
  private stressListeners: Array<(data: StressData) => void> = [];
  private presenceListeners: Array<(members: Set<string>) => void> = [];
  private errorListeners: Array<(error: Error) => void> = [];
  private isConnected = false;

  /**
   * Connect to PartyKit room.
   * Each user gets their own room for private data.
   * Team rooms can be created for shared dashboards.
   */
  connect(userId: string, room = "mindpulse-stress") {
    if (this.socket) {
      this.socket.close();
    }

    this.userId = userId;

    // PartyKit connection with automatic reconnection
    this.socket = new PartySocket({
      host: process.env.NEXT_PUBLIC_PARTYKIT_HOST || "mindpulse.partykit.dev",
      room: `${room}-${userId}`,
    });

    this.socket.addEventListener("open", () => {
      this.isConnected = true;
      console.log(`[PartyKit] Connected as ${userId}`);
    });

    this.socket.addEventListener("message", (event) => {
      try {
        const msg: PartyMessage = JSON.parse(event.data);
        this.handleMessage(msg);
      } catch {
        // Ignore non-JSON messages
      }
    });

    this.socket.addEventListener("close", () => {
      this.isConnected = false;
      console.log("[PartyKit] Disconnected");
    });

    this.socket.addEventListener("error", (error) => {
      this.errorListeners.forEach((fn) => fn(new Error(String(error))));
    });

    return this;
  }

  /**
   * Send stress data to the room.
   */
  sendStressData(data: StressData) {
    if (!this.socket || !this.isConnected) return;

    this.socket.send(
      JSON.stringify({
        type: "stress_update",
        data,
        userId: this.userId,
        timestamp: Date.now(),
      })
    );
  }

  /**
   * Listen for stress score updates.
   */
  onStressUpdate(callback: (data: StressData) => void) {
    this.stressListeners.push(callback);
    return () => {
      this.stressListeners = this.stressListeners.filter((fn) => fn !== callback);
    };
  }

  /**
   * Listen for presence changes (who's online).
   */
  onPresenceChange(callback: (members: Set<string>) => void) {
    this.presenceListeners.push(callback);
    return () => {
      this.presenceListeners = this.presenceListeners.filter((fn) => fn !== callback);
    };
  }

  /**
   * Listen for connection errors.
   */
  onError(callback: (error: Error) => void) {
    this.errorListeners.push(callback);
    return () => {
      this.errorListeners = this.errorListeners.filter((fn) => fn !== callback);
    };
  }

  /**
   * Disconnect from PartyKit.
   */
  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.isConnected = false;
    }
  }

  /**
   * Check if currently connected.
   */
  get connected(): boolean {
    return this.isConnected;
  }

  // ─── Private ───

  private handleMessage(msg: PartyMessage) {
    switch (msg.type) {
      case "stress_update":
        this.stressListeners.forEach((fn) => fn(msg.data as StressData));
        break;
      case "presence":
        this.presenceListeners.forEach((fn) => fn(new Set(msg.data as string[])));
        break;
      default:
        break;
    }
  }
}

// ─── Singleton Export ───

export const partyKitClient = new PartyKitClient();

// ─── Convenience Hook for React ───

import { useEffect, useRef, useCallback } from "react";

export function usePartyKit(userId: string | null) {
  const clientRef = useRef<PartyKitClient | null>(null);

  useEffect(() => {
    if (!userId) return;

    clientRef.current = partyKitClient;
    partyKitClient.connect(userId);

    return () => {
      partyKitClient.disconnect();
    };
  }, [userId]);

  const sendStress = useCallback((data: StressData) => {
    partyKitClient.sendStressData(data);
  }, []);

  return { sendStress, connected: partyKitClient.connected };
}
