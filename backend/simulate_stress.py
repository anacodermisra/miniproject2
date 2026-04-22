import time
import random
from pynput.keyboard import Controller as KeyboardController, Key
from pynput.mouse import Controller as MouseController, Button

def simulate_stress():
    print("MindPulse Stress Simulator")
    print("Starting in 3 seconds... Open your dashboard so you can watch!")
    time.sleep(3)
    
    keyboard = KeyboardController()
    mouse = MouseController()
    
    print("Phase 1: Simulating erratic typing with high error rate (Backspaces)...")
    for _ in range(15): # 15 chaotic bursts
        # Type a chaotic burst
        for _ in range(random.randint(3, 8)):
            char = chr(random.randint(97, 122))
            keyboard.press(char)
            # Long and erratic hold times
            time.sleep(random.uniform(0.1, 0.4)) 
            keyboard.release(char)
            # Short flight times
            time.sleep(random.uniform(0.01, 0.05)) 
        
        # High error rate (Backspace)
        for _ in range(random.randint(2, 5)):
            keyboard.press(Key.backspace)
            time.sleep(0.1)
            keyboard.release(Key.backspace)
            time.sleep(0.1)
            
        # Pause to simulate fragmentation / fits and starts
        time.sleep(random.uniform(0.5, 1.5))
        
    print("Phase 2: Simulating RAGE CLICKS...")
    # Rage clicks: >3 rapid clicks in the same area within 2 seconds
    for _ in range(6):  # 6 distinct rage click clusters
        # Shift the mouse randomly for a new cluster
        mouse.move(random.randint(-50, 50), random.randint(-50, 50))
        time.sleep(0.5)
        # 5 extremely rapid clicks
        for _ in range(5):
            mouse.press(Button.left)
            time.sleep(0.02)
            mouse.release(Button.left)
            time.sleep(0.05)
        time.sleep(1.0) # Wait a bit between clusters

    print("Phase 3: Simulating erratic mouse scrolling and direction changes...")
    for _ in range(25):
        # Move back and forth erratically
        mouse.move(random.randint(-200, 200), random.randint(-200, 200))
        # Aggressive scrolling
        mouse.scroll(0, random.randint(-10, 10))
        time.sleep(0.1)

    print("Stress Simulation Complete! Wait 5 seconds for the dashboard to aggregate the data.")

if __name__ == "__main__":
    simulate_stress()
