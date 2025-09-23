"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

interface ValuationResult {
  investmentAccountId: string;
  accountName: string;
  assetSymbol: string;
  quantity: number;
  oldValue: number;
  newValue: number;
  change: number;
  changePercent: number;
  pricePerUnit: number;
}

interface ValuationUpdateResponse {
  success: boolean;
  processed: number;
  updated: number;
  results: ValuationResult[];
  errors: string[];
}

export function ValuationUpdater() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [lastResult, setLastResult] = useState<ValuationUpdateResponse | null>(null);

  const handleUpdateValuations = async () => {
    setIsUpdating(true);

    try {
      const response = await fetch("/api/investments/valuations/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const result: ValuationUpdateResponse = await response.json();

      if (!response.ok) {
        throw new Error(result.errors?.[0] || "Failed to update valuations");
      }

      setLastResult(result);
      setLastUpdate(new Date());

      // Refresh the page to show updated values
      if (result.updated > 0) {
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }

    } catch (error) {
      console.error("Failed to update valuations:", error);
      setLastResult({
        success: false,
        processed: 0,
        updated: 0,
        results: [],
        errors: [error instanceof Error ? error.message : "Unknown error"]
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Market Valuations</span>
          <Button
            onClick={handleUpdateValuations}
            disabled={isUpdating}
            variant="secondary"
            size="sm"
          >
            {isUpdating ? "Updating..." : "Update Now"}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {lastUpdate && (
          <p className="text-sm text-gray-600">
            Last updated: {lastUpdate.toLocaleString()}
          </p>
        )}

        {lastResult && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge tone={lastResult.success ? "success" : "danger"}>
                {lastResult.success ? "Success" : "Failed"}
              </Badge>
              <span className="text-sm">
                {lastResult.updated} of {lastResult.processed} accounts updated
              </span>
            </div>

            {lastResult.errors.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-red-600">Errors:</h4>
                {lastResult.errors.map((error, index) => (
                  <p key={index} className="text-sm text-red-500">
                    {error}
                  </p>
                ))}
              </div>
            )}

            {lastResult.results.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Updates:</h4>
                {lastResult.results.map((result, index) => (
                  <div key={index} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                    <div>
                      <span className="font-medium">{result.assetSymbol}</span>
                      <span className="text-gray-600 ml-2">
                        {result.quantity} @ {formatCurrency(result.pricePerUnit)}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">
                        {formatCurrency(result.newValue)}
                      </div>
                      <div className={`text-xs ${result.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {result.change >= 0 ? '+' : ''}{formatCurrency(result.change)}
                        ({result.changePercent.toFixed(1)}%)
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="text-xs text-gray-500 space-y-1">
          <p>• Updates investment account values based on current market prices</p>
          <p>• Creates valuation adjustment transactions automatically</p>
          <p>• Data sourced from CoinGecko API</p>
        </div>
      </CardContent>
    </Card>
  );
}