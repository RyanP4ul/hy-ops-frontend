import { ModalProvider } from "@/components/providers/modal-provider";
import { ArchiveProvider } from "./provider";
import ArchivePage from "./components/archve-page";
import ArchiveDialog from "./components/dialog";
import { MotionPage } from "@/components/page-motion";
import { Archive } from "lucide-react";
import { ManagementPageHeading } from "@/components/management-list";

export default function Page() {
  return (
    <MotionPage className="flex flex-col gap-4 md:gap-6 py-4 md:py-6 px-4 lg:px-6">
      <ModalProvider>
        <ArchiveProvider>
          <section className="space-y-5">
            <ManagementPageHeading title="Archives" description="Review archived records and restore accounts or warehouse locations when needed." icon={<Archive className="size-5" />} />
            <ArchiveDialog />
            <ArchivePage />
          </section>
        </ArchiveProvider>
      </ModalProvider>
    </MotionPage>
  );
}
