# MindPulse Website Architecture & Data Flow Status

*April 20, 2026*

This report details a full audit of the MindPulse frontend dashboard to determine the integration state between the UI and the backend. It contrasts areas driven by **Live Real-time Data** against those driven by **Dummy/Static Data**.

## 📊 Overview

The MVP's transition to a realistic production model has been highly successful. **The core dashboard is completely wired to the backend API.** Unlike early prototypes, the primary applications (Tracking, History, Insights) dynamically render UI based on actual telemetry generated from your desktop actions!

---

## 🟢 Fully Functional (Real Data)

The following dashboard areas are completely connected to the `localhost:5000` backend API:

### 1. Live Tracking Page (`/tracking`)
*   **Live Energy Gauge**: Uses a WebSocket (`useStressStream`) to instantly update the 0-100 score based on your continuous keystroke and mouse telemetry. 
*   **Metric Tiles**: Polled via `/api/v1/metrics`. It shows actual Live WPM, Error Rates, and Rage Clicks instead of hard-coded visualizations.
*   **Intervention Banners**: The app actively calls `/api/v1/interventions/recommendation` to serve real-time coaching text ("A break might help", "Stable rhythm") depending on your recent behavioral decay.
*   **Recalibrate Tool**: Connects to an API endpoint which actively affects your personalized ML baseline.

### 2. History Page (`/history`)
*   **Interactive Area Chart**: Fetches timeline data via `api.history(userId, hours)`. Maps chronological `score` and `level` objects entirely from your SQLite records up to 7 days.
*   **Recent Signals Board**: Lists your exact transitions between NEUTRAL, MILD, and STRESS levels in descending order.
*   **Break History**: Lists out previous interventions using `api.interventionHistory`—documenting if a suggestion helped or was rejected.

### 3. Insights Page (`/insights`)
*   **Best Hours / Week Patterns**: Entirely dynamic! The `InsightsPage` pulls a 7-day `/api/v1/history` payload and performs **real-time client-side aggregation** to determine your actual most productive days and hours.
*   **Weekly Wins Streak**: Evaluates your history array logic to deduce how many consecutive days you had predominantly good energy levels.

### 4. Authentication (`/signup` & `/login`)
*   **Forms**: Standard username/password fields hook directly into the backend's `/api/v1/auth/signup` logic (which is now confirmed fully operable). JWT tokens are preserved in local storage.

---

## 🟡 Partially Functional / Logic Driven (Edge Cases)

*   **Mockup Prototype (`/mockup`)**: 
    There is a page route specifically left in the codebase at `app/(app)/mockup/page.tsx`. This exists solely as a structural dummy test-bed for visualizing UI layouts without needing to start the backend Python server. It doesn't connect to actual metrics.
*   **Wind-Down Interventions**:
    The system correctly retrieves "checkWindDown" responses from the API, but triggering the specific severity criteria inside the ML layer requires very long computer sessions (e.g., late-night burnout simulation) which can take hours of continuous usage to accurately record.
    
---

## 💡 Summary

**There is practically no "fake UI" driving the MindPulse application anymore.** 

The entire layout relies on a robust schema design. If the backend does not provide data—like newly created users—the application truthfully reports "Collecting Data" or "More data needed" rather than faking UI graphs like a prototype would.
