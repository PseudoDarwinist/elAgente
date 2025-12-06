#!/usr/bin/env python3
"""
Demo Application for SRE Agent Testing

This app simulates a payment service that can have various faults injected.
It writes structured JSON logs to ./logs/app.log which Promtail ships to Loki.

Usage:
    python demo_app.py                    # Run normally
    python demo_app.py --fault db         # Simulate database issue
    python demo_app.py --fault cache      # Simulate cache issue
    python demo_app.py --fault memory     # Simulate memory issue
    python demo_app.py --fault code       # Simulate code bug
"""

import argparse
import json
import random
import time
import sys
from datetime import datetime
from pathlib import Path

# Ensure logs directory exists
LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(exist_ok=True)
LOG_FILE = LOG_DIR / "app.log"

SERVICE_NAME = "payment-service"


def log(level: str, msg: str, **extra):
    """Write a structured JSON log line."""
    entry = {
        "ts": datetime.utcnow().isoformat() + "Z",
        "level": level,
        "service": SERVICE_NAME,
        "msg": msg,
        **extra
    }
    line = json.dumps(entry)
    print(line)
    with open(LOG_FILE, "a") as f:
        f.write(line + "\n")


def simulate_normal():
    """Simulate normal application behavior."""
    log("info", "Payment request received", request_id="req-" + str(random.randint(1000, 9999)))
    time.sleep(0.1)
    log("info", "Processing payment", latency_ms=random.randint(50, 200))
    time.sleep(0.1)
    log("info", "Payment completed successfully", latency_ms=random.randint(100, 300))


def simulate_db_issue():
    """Simulate database connection pool exhaustion."""
    log("info", "Payment request received", request_id="req-" + str(random.randint(1000, 9999)))
    time.sleep(0.1)
    
    # Simulate connection pool filling up
    for i in range(5):
        pool_used = 90 + i * 2
        log("warn", f"Database connection pool at {pool_used}%", 
            db_pool_used=pool_used, db_pool_max=100)
        time.sleep(0.2)
    
    log("error", "Failed to acquire database connection",
        error="Connection pool exhausted",
        db_pool_used=100,
        db_pool_max=100,
        query="SELECT * FROM orders WHERE user_id = ?",
        latency_ms=30000,
        stack_trace="org.postgresql.util.PSQLException: Cannot get connection, pool exhausted\n"
                   "    at com.zaxxer.hikari.pool.HikariPool.getConnection(HikariPool.java:155)\n"
                   "    at com.payment.service.OrderDao.findOrders(OrderDao.java:42)\n"
                   "    at com.payment.service.PaymentHandler.process(PaymentHandler.java:78)")
    
    log("error", "Payment processing failed",
        error="DatabaseConnectionException",
        latency_ms=30500,
        file="src/payment/handler.py",
        line=78)


def simulate_cache_issue():
    """Simulate Redis cache miss causing high latency."""
    log("info", "Payment request received", request_id="req-" + str(random.randint(1000, 9999)))
    time.sleep(0.1)
    
    log("warn", "Cache miss for user session",
        cache_hit=False,
        cache_key="session:user:12345",
        fallback="database")
    
    log("warn", "High cache miss rate detected",
        cache_hit_rate=0.15,
        cache_miss_rate=0.85,
        cache_connections=3,
        cache_max_connections=10)
    
    log("error", "Request timeout - cache miss caused DB overload",
        error="TimeoutException",
        latency_ms=8000,
        cache_hit=False,
        db_query_ms=7500,
        file="src/payment/cache_client.py",
        line=156)


def simulate_memory_issue():
    """Simulate memory leak / OOM condition."""
    log("info", "Payment request received", request_id="req-" + str(random.randint(1000, 9999)))
    
    for i in range(3):
        heap_used = 70 + i * 10
        log("warn", f"High memory usage: {heap_used}%",
            heap_used_mb=int(heap_used * 10.24),
            heap_max_mb=1024,
            gc_pause_ms=random.randint(100, 500))
        time.sleep(0.3)
    
    log("error", "OutOfMemoryError: Java heap space",
        error="OutOfMemoryError",
        heap_used_mb=1020,
        heap_max_mb=1024,
        gc_pause_ms=2500,
        stack_trace="java.lang.OutOfMemoryError: Java heap space\n"
                   "    at java.util.Arrays.copyOf(Arrays.java:3210)\n"
                   "    at com.payment.service.OrderCache.loadAll(OrderCache.java:89)\n"
                   "    at com.payment.service.PaymentHandler.process(PaymentHandler.java:45)")


def simulate_code_bug():
    """Simulate a NullPointerException / code bug."""
    log("info", "Payment request received", request_id="req-" + str(random.randint(1000, 9999)))
    time.sleep(0.1)
    
    log("error", "NullPointerException in payment processing",
        error="NullPointerException",
        message="Cannot invoke method on null object",
        file="src/payment/validator.py",
        line=42,
        function="validate_card_details",
        stack_trace="TypeError: 'NoneType' object is not subscriptable\n"
                   "    at validate_card_details (src/payment/validator.py:42)\n"
                   "    at process_payment (src/payment/handler.py:78)\n"
                   "    at handle_request (src/payment/api.py:23)")
    
    log("error", "Payment validation failed - card_details was None",
        error="ValidationError",
        field="card_details",
        expected="dict",
        actual="NoneType",
        file="src/payment/validator.py",
        line=42)


def main():
    parser = argparse.ArgumentParser(description="Demo app for SRE Agent testing")
    parser.add_argument("--fault", choices=["db", "cache", "memory", "code", "none"],
                       default="none", help="Type of fault to simulate")
    parser.add_argument("--loop", action="store_true", help="Run continuously")
    args = parser.parse_args()
    
    print(f"🚀 Starting {SERVICE_NAME} demo")
    print(f"📝 Logging to {LOG_FILE}")
    print(f"💥 Fault mode: {args.fault}")
    print()
    
    fault_handlers = {
        "none": simulate_normal,
        "db": simulate_db_issue,
        "cache": simulate_cache_issue,
        "memory": simulate_memory_issue,
        "code": simulate_code_bug,
    }
    
    handler = fault_handlers[args.fault]
    
    try:
        if args.loop:
            while True:
                handler()
                time.sleep(2)
        else:
            handler()
    except KeyboardInterrupt:
        print("\n👋 Shutting down demo app")


if __name__ == "__main__":
    main()
