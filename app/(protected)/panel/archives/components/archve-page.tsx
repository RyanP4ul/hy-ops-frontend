import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import DataTable from "./data-table";

export default function ArchivePage() {
  return (
    <section>
      <Card>
        <CardHeader>
          <CardTitle className="leading-none">Archives</CardTitle>
          <CardDescription>
            Review archived records and restore items that need to be reactivated.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <DataTable />
        </CardContent>
      </Card>
    </section>
  );
}
