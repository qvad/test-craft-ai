#!/usr/bin/env python3
"""
TestCraft AI - Development Startup Script
Starts all services: Docker infrastructure, API backend, and Angular frontend.

Usage:
    python start.py          # Start all services
    python start.py --stop   # Stop all services
"""

import subprocess
import sys
import os
import time
import signal
import argparse
from pathlib import Path

# Colors for terminal output
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'

def log(msg, color=Colors.GREEN):
    print(f"{color}{Colors.BOLD}[TestCraft]{Colors.END} {msg}")

def log_error(msg):
    log(msg, Colors.RED)

def log_info(msg):
    log(msg, Colors.BLUE)

def log_warn(msg):
    log(msg, Colors.YELLOW)

# Store child processes for cleanup
processes = []

def cleanup(signum=None, frame=None):
    """Stop all running processes."""
    log_warn("\nShutting down services...")

    for name, proc in processes:
        if proc and proc.poll() is None:
            log_info(f"Stopping {name}...")
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()

    # Stop Docker containers (only if Docker is available)
    try:
        subprocess.run(["docker", "--version"], capture_output=True, check=True)
        log_info("Stopping Docker containers...")
        subprocess.run(
            ["docker", "compose", "-f", "docker-compose.yaml", "down"],
            cwd=ROOT_DIR,
            capture_output=True
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass  # Docker not available, skip

    log("All services stopped.")
    sys.exit(0)

# Register signal handlers
signal.signal(signal.SIGINT, cleanup)
signal.signal(signal.SIGTERM, cleanup)

# Project root directory
ROOT_DIR = Path(__file__).parent.absolute()

def check_prerequisites(skip_docker=False):
    """Check if required tools are installed."""
    log_info("Checking prerequisites...")

    required = {
        "node": "Node.js",
        "npm": "npm",
    }

    if not skip_docker:
        required["docker"] = "Docker"

    missing = []
    for cmd, name in required.items():
        try:
            subprocess.run([cmd, "--version"], capture_output=True, check=True)
        except (subprocess.CalledProcessError, FileNotFoundError):
            missing.append(name)

    if missing:
        log_error(f"Missing required tools: {', '.join(missing)}")
        log_error("Please install them and try again.")
        sys.exit(1)

    log("Prerequisites OK")

def install_dependencies():
    """Install npm dependencies if needed."""
    # Check root node_modules
    if not (ROOT_DIR / "node_modules").exists():
        log_info("Installing root dependencies...")
        subprocess.run(["npm", "install"], cwd=ROOT_DIR, check=True)

    # Check API node_modules
    api_dir = ROOT_DIR / "apps" / "api"
    if not (api_dir / "node_modules").exists():
        log_info("Installing API dependencies...")
        subprocess.run(["npm", "install"], cwd=api_dir, check=True)

    log("Dependencies OK")

def start_docker():
    """Start Docker infrastructure (YugabyteDB + Redis)."""
    log_info("Starting Docker infrastructure...")

    docker_compose = ROOT_DIR / "docker-compose.yaml"

    if not docker_compose.exists():
        log_warn("docker-compose.yaml not found, skipping Docker...")
        return

    result = subprocess.run(
        ["docker", "compose", "-f", str(docker_compose), "up", "-d"],
        cwd=ROOT_DIR,
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        log_error(f"Docker failed: {result.stderr}")
        log_warn("Continuing without Docker infrastructure...")
    else:
        log("Docker infrastructure started")
        # Wait for services to be ready
        log_info("Waiting for database to be ready...")
        time.sleep(5)

def start_api():
    """Start the backend API server."""
    log_info("Starting API server on port 3000...")

    api_dir = ROOT_DIR / "apps" / "api"

    if not api_dir.exists():
        log_error("apps/api directory not found!")
        return None

    # Use npm run dev for the API
    proc = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=api_dir,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )

    processes.append(("API Server", proc))
    log("API server starting... (http://localhost:3000)")
    return proc

def start_frontend():
    """Start the Angular frontend."""
    log_info("Starting frontend on port 4200...")

    proc = subprocess.Popen(
        ["npm", "start"],
        cwd=ROOT_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )

    processes.append(("Frontend", proc))
    log("Frontend starting... (http://localhost:4200)")
    return proc

def wait_for_ready(proc, name, ready_text, timeout=60):
    """Wait for a process to output ready text."""
    start = time.time()
    while time.time() - start < timeout:
        if proc.poll() is not None:
            log_error(f"{name} exited unexpectedly!")
            return False

        line = proc.stdout.readline()
        if line:
            # Print output for debugging
            if "--verbose" in sys.argv:
                print(f"  [{name}] {line.strip()}")
            if ready_text.lower() in line.lower():
                return True

    log_warn(f"{name} didn't report ready within {timeout}s, continuing anyway...")
    return True

def stream_output(procs):
    """Stream output from all processes."""
    import select

    # Map file descriptors to names
    fd_to_name = {}
    for name, proc in procs:
        if proc and proc.stdout:
            fd_to_name[proc.stdout.fileno()] = (name, proc)

    while any(proc.poll() is None for _, proc in procs if proc):
        readable = []
        for name, proc in procs:
            if proc and proc.poll() is None and proc.stdout:
                readable.append(proc.stdout)

        if not readable:
            break

        for stream in readable:
            line = stream.readline()
            if line:
                name = fd_to_name.get(stream.fileno(), ("Unknown", None))[0]
                print(f"{Colors.BLUE}[{name}]{Colors.END} {line.strip()}")

def stop_services():
    """Stop all services."""
    log_info("Stopping all services...")

    # Stop Docker (only if available)
    try:
        subprocess.run(["docker", "--version"], capture_output=True, check=True)
        subprocess.run(
            ["docker", "compose", "-f", "docker-compose.yaml", "down"],
            cwd=ROOT_DIR,
            capture_output=True
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass  # Docker not available, skip

    # Kill any running npm processes on our ports
    for port in [3000, 4200]:
        subprocess.run(
            ["npx", "kill-port", str(port)],
            cwd=ROOT_DIR,
            capture_output=True
        )

    log("All services stopped.")

def main():
    parser = argparse.ArgumentParser(description="TestCraft AI Development Startup")
    parser.add_argument("--stop", action="store_true", help="Stop all services")
    parser.add_argument("--no-docker", action="store_true", help="Skip Docker infrastructure")
    parser.add_argument("--api-only", action="store_true", help="Start only the API")
    parser.add_argument("--frontend-only", action="store_true", help="Start only the frontend")
    parser.add_argument("--verbose", action="store_true", help="Show all output")
    args = parser.parse_args()

    os.chdir(ROOT_DIR)

    print(f"""
{Colors.BOLD}{Colors.BLUE}╔══════════════════════════════════════════╗
║         TestCraft AI Starter             ║
╚══════════════════════════════════════════╝{Colors.END}
""")

    if args.stop:
        stop_services()
        return

    try:
        # Check prerequisites
        check_prerequisites(skip_docker=args.no_docker or args.frontend_only)

        # Install dependencies
        install_dependencies()

        # Start Docker infrastructure
        if not args.no_docker and not args.frontend_only:
            start_docker()

        # Start API
        api_proc = None
        if not args.frontend_only:
            api_proc = start_api()
            time.sleep(3)  # Give API time to start

        # Start frontend
        frontend_proc = None
        if not args.api_only:
            frontend_proc = start_frontend()

        # Print status
        print(f"""
{Colors.GREEN}{Colors.BOLD}═══════════════════════════════════════════
  All services started!
═══════════════════════════════════════════{Colors.END}

  {Colors.BLUE}Frontend:{Colors.END}    http://localhost:4200
  {Colors.BLUE}API:{Colors.END}         http://localhost:3000
  {Colors.BLUE}YugabyteDB:{Colors.END}  http://localhost:7000

  Press {Colors.YELLOW}Ctrl+C{Colors.END} to stop all services
""")

        # Keep running and stream output
        active_procs = [(n, p) for n, p in processes if p]
        if active_procs:
            stream_output(active_procs)

    except KeyboardInterrupt:
        cleanup()
    except Exception as e:
        log_error(f"Error: {e}")
        cleanup()
        sys.exit(1)

if __name__ == "__main__":
    main()
