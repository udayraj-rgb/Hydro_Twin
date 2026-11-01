# HydroTwin-PHM: Digital Twin & Virtual Hardware-in-the-Loop (HIL) Testbed
**AtomQuest 2026 — Track 2: Water Purifier**  
*Team Atomizers | School of Computing Science and Engineering (SCOPE), VIT Bhopal*

---

## 📌 Executive Architecture & Mathematical Modeling

**HydroTwin-PHM Phase 1** is a standalone, zero-dependency, edge-virtualized Hardware-in-the-Loop (HIL) testbed and Prognostics & Health Management (PHM) simulation environment. It models an **Atomberg Smart IoT Water Purifier** powered by an **ESP32-WROOM-32D** dual-core microcontroller running FreeRTOS v10.4.

---

## 📊 Real-Time Visual Telemetry Charts (Chart.js)

The prototype integrates **Chart.js** via CDN and renders two side-by-side real-time rolling charts updating at 1 Hz with a rolling 20-second circular buffer:

### CHART 1: "Hydraulic Impedance & Stage Decoupling Engine"
- **Curve 1 (Amber `#fbbf24`)**: Pre-Sediment Flow Resistance ($R_{sediment}$)
- **Curve 2 (Cyan `#22d3ee`)**: RO Membrane Cake Surface Layer ($R_{cake}$)
- **Curve 3 (Purple Dashed `#c084fc`)**: Fouling Limit Threshold ($1.20\text{ kPa}\cdot\text{s/L}$)
- **Y-Axis**: Hydraulic Resistance ($\text{kPa}\cdot\text{s/L}$)
- **X-Axis**: Rolling Time ($T\text{-sec}$, from $-19\text{s}$ to $0\text{s}$)

### CHART 2: "Water Purity & Membrane Rejection Profile"
- **Curve 1 (Rose/Red `#f43f5e`)**: Raw Inlet TDS ($\text{ppm}$) [Primary Left Y-Axis]
- **Curve 2 (Green/Emerald `#10b981`)**: Permeate Outlet TDS ($\text{ppm}$) [Primary Left Y-Axis]
- **Curve 3 (Blue/Sky `#38bdf8`)**: Salt Rejection Efficiency ($\eta$ %) [Secondary Right Y-Axis: $0 - 100\%$]
- **X-Axis**: Rolling Time ($T\text{-sec}$)

---

## 📟 Live MQTT Virtual Serial Telemetry Console

Positioned directly below the dual charts is a production edge MQTT streaming terminal emulator (`bg-black/90 text-green-400 font-mono text-xs h-36 overflow-y-auto`):
- **Topic**: `atomberg/purifier/edge/v1/telemetry`
- **Cadence**: 1 Hz deterministic tick
- **Production Edge JSON Schema**:
  ```json
  {
    "device_id": "ATOM-WP-2026-0042",
    "timestamp": 1792746230,
    "Ia_amps": 0.85,
    "flow_lpm": 1.20,
    "tds_in": 850,
    "tds_out": 60,
    "eta": 95.05,
    "R_sed": 0.60,
    "R_cake": 0.18,
    "flush_solenoid": 0,
    "failsafe": "NOMINAL"
  }
  ```
- **Terminal Controls**:
  - **Pause/Resume Stream**: Suspends or resumes line generation.
  - **Clear Terminal**: Flushes the terminal log buffer.
  - **Auto-Scroll**: Automatically pins the terminal view to the latest incoming packet.

---

## 📐 Mathematical Formulation & Closed-Loop Control Algorithms

### 1. Darcy-Hermia Multi-Stage Hydraulic Decoupling
Executed every 1000 ms in a deterministic discrete tick loop on FreeRTOS Core 1:
- **Permeate Volumetric Flux**:
  $$J = \frac{\text{FlowRate}}{A} \quad (A = 1.0\text{ m}^2)$$
- **Inferred Trans-Membrane Delivery Pressure**:
  $$\Delta P = (1.45 \times \text{PumpCurrent}) - 0.12 \quad (\text{bar})$$
- **Dynamic Osmotic Pressure**:
  $$\Delta \pi = 1.12 \times (\text{InletTDS} - \text{OutletTDS}) \times 0.00075 \quad (\text{bar})$$
- **Temperature Viscosity Correction ($T = 25^\circ\text{C}$)**:
  $$\mu = 1.002 \times (1.0 - (0.02 \times (T - 20))) = 0.9018\text{ mPa}\cdot\text{s}$$
- **Pre-Sediment Choking Resistance ($R_{sed}$)**:
  $$R_{sed} = \max\left(0.1, \frac{\text{PumpCurrent}}{\max(\text{FlowRate}, 0.1)} \times 0.85\right)$$
- **RO Surface Cake Resistance ($R_{cake}$) via Darcy's Law**:
  $$R_{cake} = \max\left(0.1, \frac{\Delta P - \Delta \pi}{\mu \times \max(J, 0.05)} - R_{membrane\_clean}\right) \times \text{WashdownFactor}$$
- **Salt Rejection Efficiency**:
  $$\eta = \left(1 - \frac{\text{OutletTDS}}{\max(\text{InletTDS}, 1)}\right) \times 100\%$$
- **Alkaliser Elution Balance**:
  $$\Delta \text{TDS}_{mineral} = \max\left(0, \text{OutletTDS} - \left(\text{InletTDS} \times \left(1 - \frac{\eta}{100}\right)\right)\right)$$

---

### 2. Stage-Specific Health Scoring
Maps raw resistances, cumulative throughput, and rejection rates into continuous percentage health metrics ($0 - 100\%$):
- **Pre-Sediment Filter Health %**:
  $$\text{Health}_{sed} = \max(0, 100 - (R_{sed} \times 28))$$
- **Activated Carbon Block Health %**:
  $$\text{Health}_{carbon} = \max(0, 100 - (\text{CumulativeLiters} \times 0.015))$$
- **RO Membrane Health %**:
  $$\text{Health}_{RO} = \max\left(0, \frac{\eta}{95.0} \times 100 - (R_{cake} \times 15)\right)$$
- **Post-Alkaliser & Mineralizer Health %**:
  $$\text{Health}_{alkaliser} = \min\left(100, \max\left(0, \frac{\Delta \text{TDS}_{mineral}}{30.0} \times 100\right)\right)$$

---

### 3. Adaptive Predictive Anti-Scaling Dynamic Flush Controller
- **Concentration Polarization Index**:
  $$\text{CP\_Index} = \left(\frac{\text{InletTDS}}{1000.0}\right) \times \left(\frac{\Delta P}{\max(\text{FlowRate}, 0.2)}\right)$$
- **Closed-Loop Trigger Rule**:
  $$\text{If } \text{CP\_Index} > 1.25 \quad \text{OR} \quad \text{InletTDS} > 1200\text{ ppm}$$
  - Trips the Dynamic Anti-Scaling Flush Solenoid (LED pulses blue).
  - Triggers onscreen notification banner:
    > *"CLOSED-LOOP ACTIVE: Dynamic Anti-Scaling Micro-Flush in progress. Disrupting crystal nucleation layer."*
  - Applies a dynamic wash-down reducing $R_{cake}$ by $18\%$ over a 6-second window, then returns solenoid to idle.

---

### 4. Deterministic Sub-200ms Edge Safety Interlocks
Executes synchronously on sensor shifts and input changes ($< 15\text{ ms}$ response time):
1. **Dry-Run Cavitation Guard** ($\text{Pump Current} < 0.15\text{ A}$):
   - Trips Booster Pump Relay to `OPEN / RED`.
   - Displays modal: `"SAFETY TRIP (<180ms): Dry-Run Cavitation Detected. Booster Pump Cut Off."`
2. **Motor Armature Stall Guard** ($\text{Pump Current} > 1.80\text{ A}$):
   - Trips Booster Pump Relay to `OPEN / RED`.
   - Displays modal: `"SAFETY TRIP (<160ms): Motor Armature Overcurrent Stall."`
3. **Membrane Rupture Critical Breach Guard** ($\text{OutletTDS} \ge 0.50 \times \text{InletTDS}$):
   - Locks out Inlet Solenoid Valve (`ISOLATED / RED`) and disengages pump.
   - Displays modal: `"CRITICAL BREACH: Membrane Rupture Detected. Water Dispense Halted."`

---

### 5. Remaining Useful Life (RUL) Survival Regressor
- **RUL Calculation**:
  $$\text{RUL}_{days} = \text{round}\Big(\min(\text{Sediment\_Health}, \text{RO\_Health}, \text{Carbon\_Health}) \times 0.45\Big)$$
- **Auto-Replenishment Threshold**:
  $$\text{If } \text{RUL}_{days} \le 14\text{ days}$$
  - Top KPI Badge pulses green:
    > *"AUTOMATED ATOMBERG D2C REPLENISHMENT DISPATCHED: Replacement Cartridges en route (Delivery in 3 Days)"*

---

## 🚀 Running the Prototype
Simply open `D:\Atomberg\index.html` directly in any web browser. Zero server installation or build steps required.
