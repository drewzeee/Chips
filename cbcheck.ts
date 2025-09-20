import "dotenv/config";
import { fetchCoinbaseAccounts } from "@/lib/integrations/coinbase";

(async () => {
  const accounts = await fetchCoinbaseAccounts();
  console.table(
    accounts.map((account) => ({
      id: account.uuid,
      name: account.name,
      currency: account.currency,
      balance: account.available_balance.value,
    }))
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
