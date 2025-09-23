#!/bin/bash

# Setup script for daily transaction import automation
# This script configures a cron job to run the transaction import daily

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMPORT_SCRIPT="$SCRIPT_DIR/import-transactions-direct.ts"
LOG_FILE="$SCRIPT_DIR/logs/import-$(date +%Y%m).log"

# Create logs directory if it doesn't exist
mkdir -p "$SCRIPT_DIR/logs"

# Function to add cron job
setup_cron() {
    local cron_time="${1:-0 9}"  # Default: 9 AM daily
    local cron_job="$cron_time * * * cd $SCRIPT_DIR && /usr/local/bin/tsx $IMPORT_SCRIPT >> $LOG_FILE 2>&1"

    echo "Setting up cron job to run daily at $(echo $cron_time | cut -d' ' -f2):$(printf "%02d" $(echo $cron_time | cut -d' ' -f1))"

    # Check if cron job already exists
    if crontab -l 2>/dev/null | grep -q "$IMPORT_SCRIPT"; then
        echo "Cron job already exists. Removing old one..."
        crontab -l 2>/dev/null | grep -v "$IMPORT_SCRIPT" | crontab -
    fi

    # Add new cron job
    (crontab -l 2>/dev/null; echo "$cron_job") | crontab -
    echo "✅ Cron job added successfully!"

    # Show current crontab
    echo "Current cron jobs:"
    crontab -l | grep "$IMPORT_SCRIPT" || echo "No matching cron jobs found"
}

# Function to remove cron job
remove_cron() {
    echo "Removing transaction import cron job..."
    crontab -l 2>/dev/null | grep -v "$IMPORT_SCRIPT" | crontab -
    echo "✅ Cron job removed!"
}

# Function to show status
show_status() {
    echo "=== Transaction Import Automation Status ==="
    echo "Script location: $IMPORT_SCRIPT"
    echo "Log file: $LOG_FILE"
    echo "Logs directory: $SCRIPT_DIR/logs"
    echo ""

    if crontab -l 2>/dev/null | grep -q "$IMPORT_SCRIPT"; then
        echo "Status: ✅ Automated (cron job active)"
        echo "Schedule:"
        crontab -l | grep "$IMPORT_SCRIPT"
    else
        echo "Status: ❌ Not automated (no cron job)"
    fi

    echo ""
    echo "Recent log files:"
    ls -la "$SCRIPT_DIR/logs/"*.log 2>/dev/null | tail -5 || echo "No log files found"
}

# Function to test the import script
test_import() {
    echo "Testing transaction import script..."
    echo "This will run a dry test of the import process."
    cd "$SCRIPT_DIR"
    /usr/local/bin/tsx "$IMPORT_SCRIPT"
}

# Main script logic
case "${1:-status}" in
    "setup")
        setup_cron "$2"
        ;;
    "remove")
        remove_cron
        ;;
    "test")
        test_import
        ;;
    "status")
        show_status
        ;;
    "help")
        echo "Usage: $0 [command] [options]"
        echo ""
        echo "Commands:"
        echo "  setup [time]  - Setup daily cron job (default: 9 AM)"
        echo "                  Time format: 'minute hour' (e.g., '30 14' for 2:30 PM)"
        echo "  remove        - Remove the cron job"
        echo "  test          - Test the import script manually"
        echo "  status        - Show current automation status (default)"
        echo "  help          - Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0 setup           # Setup to run at 9 AM daily"
        echo "  $0 setup '30 14'   # Setup to run at 2:30 PM daily"
        echo "  $0 test            # Test the import script"
        echo "  $0 remove          # Remove automation"
        ;;
    *)
        echo "Unknown command: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac