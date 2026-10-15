import { ModalProvider } from "@/components/providers/modal-provider";
import { ArchiveProvider } from "./provider";
import ArchivePage from "./components/archve-page";
import ArchiveDialog from "./components/dialog";

export default function Page() {
  return (
    <div className="flex flex-col gap-4 md:gap-6 py-4 md:py-6 px-4 lg:px-6">
      <ModalProvider>
        <ArchiveProvider>
          <section className="space-y-5">
            <div className="space-y-1">
              <h2 className="text-3xl tracking-tight">Archives</h2>
              <p className="text-muted-foreground text-sm">
                Manage your archived inventory and their variants. Click on an
                archive to view its details or restore it.
              </p>
            </div>
            <ArchiveDialog />
            <ArchivePage />
          </section>
        </ArchiveProvider>
      </ModalProvider>
    </div>
  );
}
