"use client";

import * as React from "react";
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Hash,
  Search,
  Star,
  Tag,
  Trash2,
  Type,
  UserRound,
  Video,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

type Property = {
  id: string;
  name: string;
  description: string;
  example: string;
  type: string;
  icon: React.ElementType;
};

const properties: Property[] = [
  {
    id: "video-name",
    name: "video name",
    description: "NAME OF THE VIDEO THAT HAS BEEN WATCHED",
    example: "700.0 K views with properly",
    type: "string",
    icon: Video,
  },
  {
    id: "date",
    name: "Date",
    description: "The date when the event occurred",
    example: "September 18, 2026",
    type: "date",
    icon: CalendarDays,
  },
  {
    id: "subscribers",
    name: "# of subscribers",
    description: "Number of subscribers at the time of the event",
    example: "50 subscribers",
    type: "number",
    icon: UserRound,
  },
  {
    id: "views",
    name: "# of views",
    description: "Number of views associated with the video",
    example: "700.0 K views",
    type: "number",
    icon: Hash,
  },
  {
    id: "hashtags",
    name: "#hashtags",
    description: "Hashtags associated with the video",
    example: "#technology #coding",
    type: "string",
    icon: Tag,
  },
];

const tabs = ["ALL", "EVENT", "USER", "COMPANY ID", "CONTENT"];

export default function PropertyPicker() {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [activeTab, setActiveTab] = React.useState("EVENT");
  const [selected, setSelected] = React.useState<Property>(properties[0]);

  const filteredProperties = properties.filter((property) =>
    property.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className="h-8 gap-1.5 rounded-md px-2.5 text-xs font-normal"
          >
            <Video className="size-3.5" />
            {selected.name}
          </Button>
        }
      />

      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[650px] overflow-hidden rounded-lg p-0 shadow-xl"
      >
        <div className="grid grid-cols-[310px_1fr]">
          {/* LEFT PANEL */}
          <div className="min-w-0 border-r">
            {/* Search */}
            <div className="p-2.5">
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />

                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search"
                  className="h-9 pl-8 text-xs"
                />
              </div>
            </div>

            {/* Tabs */}
            <div className="flex h-8 items-center gap-4 overflow-hidden px-3">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={[
                    "relative h-full shrink-0 text-[9px] font-medium tracking-[0.12em]",
                    activeTab === tab
                      ? "text-foreground"
                      : "text-muted-foreground",
                  ].join(" ")}
                >
                  {tab}

                  {activeTab === tab && (
                    <span className="bg-primary absolute right-0 bottom-0 left-0 h-px" />
                  )}
                </button>
              ))}
            </div>

            <Separator />

            {/* Scrollable content */}
            <div className="max-h-[430px] overflow-y-auto p-2">
              {/* Recently viewed */}
              <SectionLabel>RECENTLY VIEWED</SectionLabel>

              <button
                type="button"
                onClick={() => setSelected(properties[0])}
                className={[
                  "group flex w-full items-center gap-2 rounded-md px-2 py-2 text-left",
                  selected.id === "video-name"
                    ? "bg-accent"
                    : "hover:bg-accent/60",
                ].join(" ")}
              >
                <div className="flex size-5 shrink-0 items-center justify-center rounded border">
                  <Video className="size-3 text-muted-foreground" />
                </div>

                <span className="min-w-0 flex-1 truncate text-xs">
                  video name
                </span>

                <ChevronRight className="size-3.5 text-muted-foreground" />
              </button>

              {/* Event properties */}
              <SectionLabel className="mt-5">EVENT PROPERTIES</SectionLabel>

              {/* Custom property */}
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-accent/60"
              >
                <div className="flex size-5 shrink-0 items-center justify-center">
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                </div>

                <span className="text-xs">Create a Custom Property...</span>
              </button>

              {filteredProperties.slice(1).map((property) => {
                const Icon = property.icon;

                return (
                  <button
                    key={property.id}
                    type="button"
                    onClick={() => setSelected(property)}
                    className={[
                      "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left",
                      selected.id === property.id
                        ? "bg-accent"
                        : "hover:bg-accent/60",
                    ].join(" ")}
                  >
                    <div className="flex size-5 shrink-0 items-center justify-center rounded border">
                      <Icon className="size-3 text-muted-foreground" />
                    </div>

                    <span className="min-w-0 flex-1 truncate text-xs">
                      {property.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div className="min-w-0">
            <PropertyDetails property={selected} />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PropertyDetails({ property }: { property: Property }) {
  const Icon = property.icon;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex size-5 items-center justify-center rounded border">
            <Icon className="size-3 text-muted-foreground" />
          </div>

          <h3 className="text-sm font-semibold">{property.name}</h3>
        </div>

        <p className="text-[10px] leading-4 font-medium uppercase tracking-wide text-muted-foreground">
          {property.description}
        </p>

        <div className="mt-3 space-y-1">
          <p className="text-[11px] text-muted-foreground">
            {property.example}
          </p>

          <p className="text-[11px] text-muted-foreground">
            50 queries ISO days
          </p>
        </div>
      </div>

      <Separator />

      {/* Type */}
      <div className="p-4">
        <div className="flex items-center gap-2">
          <div className="flex size-5 items-center justify-center rounded border">
            <Type className="size-3 text-muted-foreground" />
          </div>

          <span className="text-xs text-muted-foreground">{property.type}</span>
        </div>
      </div>

      {/* Mapping */}
      <div className="px-4 pb-4">
        <p className="text-[10px] leading-4 text-muted-foreground">
          This property is mapped to Video catalog - Artists.csv lookup table
        </p>

        <button
          type="button"
          className="mt-1 text-[10px] font-medium underline underline-offset-2"
        >
          View associated lookup table
        </button>
      </div>
    </div>
  );
}

function SectionLabel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`px-2 pb-1 pt-2 text-[9px] font-medium tracking-[0.14em] text-muted-foreground ${className}`}
    >
      {children}
    </div>
  );
}
