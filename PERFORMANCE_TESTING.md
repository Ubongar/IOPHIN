# IOPHIN Performance Testing and Evidence Capture

This guide helps you reproduce and document:

1. ML retraining cycle duration (HDBSCAN/K-Means pipeline)
2. Node.js memory stability under load
3. JMeter 95th percentile response time at 100 concurrent users
4. Screenshots/images for your report

## 1) Prerequisites

Install dependencies and start services:

```bash
pip install -r requirements.txt
cd server && npm install && cd ..
cd client && npm install && cd ..
docker compose up -d postgres redis
```

Run initial pipeline once so DB has data:

```bash
python -m src.main
python -m src.migrate_to_db
```

Start backend and frontend:

```bash
# terminal A
cd server && npm run dev

# terminal B
cd client && npm run dev
```

## 2) Measure retraining runtime (left-panel metric)

Use the benchmark script:

```bash
python scripts/benchmark_retrain.py --warmup 2 --iterations 10 --out results/perf/retrain_runs.csv
```

Record the reported `Average` as your retrain cycle KPI. If your average is near 14.2s, use that number.

Tip: Keep machine load consistent while measuring (close heavy background apps).

## 3) Prepare JMeter mixed workload

### Suggested read-heavy mixed workload

Create a JMeter test plan with these HTTP requests (weights):

- `GET /api/health` (10%)
- `GET /api/stats` (20%)
- `GET /api/hotspots` (30%)
- `GET /api/rankings` (20%)
- `GET /api/states` (20%)

Target host: `localhost`, port: `5000`

Thread Group baseline:

- Number of Threads (users): `100`
- Ramp-Up Period: `60` seconds
- Loop Count: `10` (or long enough for a stable plateau)

Add listeners:

- `Summary Report`
- `Aggregate Report`
- `Response Times Percentiles`
- `View Results Tree` (optional, for debugging only)

Goal check:

- 95th percentile response time <= `2000 ms`

## 4) Run load test and collect Node memory (right-panel metric)

While JMeter test is running, sample Node memory in PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/monitor_node_memory.ps1 -DurationSeconds 300 -SampleEverySeconds 2 -OutCsv results/perf/node_memory_samples.csv
```

Use the printed `Average` private memory in MB as your memory KPI (example: 340 MB).

## 5) CPU evidence for retraining

During retraining benchmark, capture CPU with Task Manager or this command:

```powershell
Get-Process python | Select-Object Id, CPU, WorkingSet, PrivateMemorySize
```

For a time series, use Performance Monitor (perfmon) counters:

- `Process(python)\% Processor Time`
- `Process(node)\Private Bytes`

## 6) Capture images for report

### Image A: Split dashboard (left/right panel)

Recommended layout:

- Left pane: terminal output from `benchmark_retrain.py` showing average duration
- Right pane: terminal output from `monitor_node_memory.ps1` summary (or CSV chart)

Take a screenshot with Windows Snipping Tool (`Win + Shift + S`) and save to:

- `results/perf/split_performance_dashboard.png`

### Image B: JMeter dashboard

In JMeter, open `Aggregate Report` or `Response Times Percentiles` and ensure it shows:

- `90% Line`
- `95% Line`
- Throughput
- Error %

Take screenshot and save to:

- `results/perf/jmeter_peak_100_users.png`

## 7) Optional: Generate JMeter HTML report

If running JMeter in non-GUI mode:

```bash
jmeter -n -t your_test_plan.jmx -l results/perf/jmeter_results.jtl -e -o results/perf/jmeter_html
```

Then screenshot `results/perf/jmeter_html/index.html` charts.

## 8) Report wording template

Use this only after you run your own measurements:

- "The HDBSCAN retraining cycle averaged `X.Y` seconds over `N` runs (p95 `Z.Z`s)."
- "Node.js private memory averaged `A` MB (min `B` MB, max `C` MB) under 100-user peak load."
- "JMeter 95th percentile response time was `P` seconds at 100 concurrent users, meeting the 2-second target."

## 9) Artifacts checklist

Ensure these files exist before finalizing your report:

- `results/perf/retrain_runs.csv`
- `results/perf/node_memory_samples.csv`
- `results/perf/split_performance_dashboard.png`
- `results/perf/jmeter_peak_100_users.png`
- `results/perf/jmeter_results.jtl` (optional)
- `results/perf/jmeter_html/` (optional)
