"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function DatabaseManagement() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    try {
      setExporting(true);
      setError(null);

      const response = await fetch('/api/export/database');

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || 'Failed to export database');
      }

      // Get the filename from the Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || `chips-export-${new Date().toISOString().split('T')[0]}.json`;

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      setError(null);
      setImportStatus(null);

      // Validate file type
      if (!file.name.endsWith('.json')) {
        throw new Error('Please select a JSON file');
      }

      // Read file content
      const text = await file.text();
      let data;

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Invalid JSON file format');
      }

      // Basic validation of export format
      if (!data.data || !data.userId || !data.exportedAt) {
        throw new Error('This does not appear to be a valid Chips database export file');
      }

      // Send to import API
      const response = await fetch('/api/import/database', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || 'Import failed');
      }

      const result = await response.json();
      setImportStatus(result.message || 'Database imported successfully. Please refresh the page.');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
      // Reset file input
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-4">
      {/* Export Section */}
      <div className="space-y-2">
        <h4 className="font-medium text-gray-900 dark:text-gray-100">Export Database</h4>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Download a complete backup of all your financial data including transactions, accounts, categories, and settings.
        </p>
        <Button
          onClick={handleExport}
          disabled={exporting}
          variant="secondary"
          className="w-full sm:w-auto"
        >
          {exporting ? 'Exporting...' : 'Export All Data'}
        </Button>
      </div>

      {/* Import Section */}
      <div className="space-y-2">
        <h4 className="font-medium text-gray-900 dark:text-gray-100">Import Database</h4>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Restore data from a previous export. This will merge the imported data with your existing data.
        </p>
        <div className="relative">
          <input
            type="file"
            accept=".json"
            onChange={handleImport}
            disabled={importing}
            className="absolute inset-0 opacity-0 cursor-pointer"
            aria-label="Import database file"
          />
          <Button
            variant="secondary"
            disabled={importing}
            className="w-full sm:w-auto"
          >
            {importing ? 'Importing...' : 'Import Data'}
          </Button>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          {error}
        </div>
      )}

      {importStatus && (
        <div className="p-3 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
          {importStatus}
        </div>
      )}
    </div>
  );
}