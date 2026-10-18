import { ModalProvider } from "@/components/providers/modal-provider";
import CalendarPage from "./components/calendar-page";
import CalendarDialog from "./components/dialog";
import { CalendarProvider } from "./provider";

export default function Page() {
  return (
    <div className="flex flex-col gap-4 md:gap-6 py-4 md:py-6 px-4 lg:px-6">
      <CalendarProvider>
        <ModalProvider>
          <section className="space-y-5">
            <CalendarDialog />
            <CalendarPage />
          </section>
        </ModalProvider>
      </CalendarProvider>
    </div>
  );
}
