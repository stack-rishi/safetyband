"""
SafetyBand - Emergency Evacuation Path Optimizer
Root entry point to launch the SafetyBand web application server.
"""

import argparse
import sys
import uvicorn

# Configure UTF-8 encoding for Windows console
if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:
        pass


def main():
    parser = argparse.ArgumentParser(description="SafetyBand Emergency Evacuation System")
    parser.add_argument("--port", type=int, default=8000, help="Web server port (default: 8000)")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Web server host (default: 127.0.0.1)")
    parser.add_argument("--reload", action="store_true", help="Enable hot reload for development")

    args = parser.parse_args()

    print("=" * 65)
    print("  Starting SafetyBand Emergency Evacuation Application")
    print(f"  URL: http://{args.host}:{args.port}")
    print("=" * 65)
    uvicorn.run("safetyband.app:app", host=args.host, port=args.port, reload=args.reload)


if __name__ == "__main__":
    main()
