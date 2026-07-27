import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { Layout, PageHeader } from "../components/layout";
import { StatCard } from "../components/ui/stat-card";
import { fmtNum } from "../lib/utils";
import type { DistilleryControlTowerSummary, Stats } from "@shared/schema";

export default function Dashboard() {
  const { data: tower } = useQuery<DistilleryControlTowerSummary>({
    queryKey: ["/api/distillery/control-tower"],
    queryFn: () => apiRequest("/api/distillery/control-tower"),
  });
  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/stats"],
    queryFn: () => apiRequest("/api/stats"),
  });

  return (
    <Layout>
      <PageHeader
        title="Control Tower"
        subtitle={tower ? `Report month: ${tower.reportMonth}` : "Distillery overview"}
      />
      <div className="p-6 space-y-6">
        <section>
          <h3 className="text-xs font-semibold text-[#737373] uppercase tracking-wide mb-3">
            Production
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Gallons Distilled" value={fmtNum(tower?.produced?.gallonsDistilled, 1)} />
            <StatCard label="Proof Gallons" value={fmtNum(tower?.produced?.proofGallons, 1)} />
            <StatCard label="Production Records" value={tower?.produced?.recordCount ?? "—"} />
            <StatCard label="Scheduled Batches" value={stats?.scheduled ?? "—"} />
          </div>
        </section>

        <section>
          <h3 className="text-xs font-semibold text-[#737373] uppercase tracking-wide mb-3">
            Bottling
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Cases Made" value={fmtNum(tower?.bottled?.casesMade, 0)} />
            <StatCard label="Bottles Made" value={fmtNum(tower?.bottled?.bottlesMade, 0)} />
            <StatCard label="Inventory Records" value={tower?.bottled?.inventoryRecordCount ?? "—"} />
            <StatCard label="Batches In Progress" value={stats?.inProgress ?? "—"} />
          </div>
        </section>

        <section>
          <h3 className="text-xs font-semibold text-[#737373] uppercase tracking-wide mb-3">
            Sales
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Total Cases Sold" value={fmtNum(tower?.sold?.totalCases, 0)} />
            <StatCard label="Distributor Cases" value={fmtNum(tower?.sold?.distributorCases, 0)} />
            <StatCard label="Retail Cases" value={fmtNum(tower?.sold?.retailCases, 0)} />
            <StatCard
              label="Orders Fulfilled"
              value={tower?.sold?.salesOrdersApprovedOrFulfilled ?? "—"}
            />
          </div>
        </section>

        <section>
          <h3 className="text-xs font-semibold text-[#737373] uppercase tracking-wide mb-3">
            Inventory Position
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Month-End Cases"
              value={fmtNum(tower?.inventory?.endingMonthInventory, 0)}
            />
            <StatCard
              label="Ending US Gallons"
              value={fmtNum(tower?.inventory?.endingUsGallons, 1)}
            />
            <StatCard
              label="Ending Proof Gallons"
              value={fmtNum(tower?.inventory?.endingProofGallons, 1)}
            />
            <StatCard label="Batches Completed" value={stats?.completed ?? "—"} />
          </div>
        </section>
      </div>
    </Layout>
  );
}
