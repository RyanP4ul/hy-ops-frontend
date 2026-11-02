"use client";

import { useState, type FormEvent } from "react";
import {
  Clipboard,
  ExternalLink,
  MapPinned,
  Navigation,
  RotateCcw,
} from "lucide-react";
import { CustomerAddressCombobox } from "./customer-address-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { GeocodingResult } from "@/types/geocode";

export default function CustomerLocationDemoPage() {
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [location, setLocation] = useState<GeocodingResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function copyCoordinates() {
    if (!location) return;
    const text = `${location.latitude}, ${location.longitude}`;
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Coordinates copied to clipboard.");
    } catch {
      setNotice(`Copy manually: ${text}`);
    }
  }

  function resetForm() {
    setCustomerName("");
    setPhone("");
    setAddress("");
    setLocation(null);
    setNotice(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(
      "Demo only: the address is selected and ready to send to your HYOps customer API. This page does not save to the database yet.",
    );
  }

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPinned className="size-4" />
            HYOps / Customers / Address picker
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                Customer delivery location
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Search for an address and select the matching result to capture
                its GPS coordinates for delivery routing.
              </p>
            </div>
            <Badge variant="outline" className="w-fit">
              Photon geocoding API
            </Badge>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]"
        >
          <Card>
            <CardHeader>
              <CardTitle>Customer information</CardTitle>
              <CardDescription>
                Choose a map result instead of relying only on manually typed
                text.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="customer-name">
                    Customer / business name
                  </Label>
                  <Input
                    id="customer-name"
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    placeholder="e.g. ABC Trading"
                    autoComplete="organization"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer-phone">Contact number</Label>
                  <Input
                    id="customer-phone"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="e.g. 09XX XXX XXXX"
                    autoComplete="tel"
                    inputMode="tel"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Delivery address *</Label>
                <CustomerAddressCombobox
                  value={address}
                  onChange={setAddress}
                  onSelect={(result) => {
                    setLocation(result);
                    setNotice(null);
                  }}
                  placeholder="Search street, barangay, business, or municipality..."
                />
                <p className="text-xs text-muted-foreground">
                  Search examples: “Guiguinto Bulacan”, “Tabang Guiguinto”, or a
                  specific street/business name.
                </p>
              </div>

              {location && (
                <div className="rounded-lg border bg-muted/20 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <p className="font-medium">Selected map result</p>
                      <p className="text-sm text-muted-foreground">
                        {location.label}
                      </p>
                    </div>
                    <Button
                      nativeButton={false}
                      render={<a href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`} target="_blank" rel="noreferrer" />}
                      size="sm"
                      variant="outline"
                      className="w-fit"
                    >
                      Verify on map <ExternalLink className="ml-2 size-3.5" />
                    </Button>
                  </div>
                  <Separator className="my-4" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Latitude</p>
                      <p className="font-mono text-sm">
                        {location.latitude.toFixed(6)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Longitude</p>
                      <p className="font-mono text-sm">
                        {location.longitude.toFixed(6)}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={copyCoordinates}
                    className="mt-4"
                  >
                    <Clipboard className="mr-2 size-4" /> Copy coordinates
                  </Button>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="submit"
                  disabled={!customerName.trim() || !location}
                >
                  <Navigation className="mr-2 size-4" /> Validate selection
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  <RotateCcw className="mr-2 size-4" /> Reset
                </Button>
              </div>
              {notice && (
                <p
                  role="status"
                  className="rounded-md border px-3 py-2 text-sm text-muted-foreground"
                >
                  {notice}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Location data</CardTitle>
              <CardDescription>
                Values you can save to the customer address record.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <DataRow
                label="Address"
                value={location?.label ?? "No address selected"}
              />
              <Separator />
              <DataRow
                label="Street / address line"
                value={location?.addressLine ?? "—"}
              />
              <DataRow
                label="District / suburb"
                value={location?.district ?? "—"}
              />
              <DataRow
                label="City / municipality"
                value={location?.city ?? "—"}
              />
              <DataRow
                label="Province / state"
                value={location?.province ?? "—"}
              />
              <Separator />
              <DataRow
                label="Latitude"
                value={location ? String(location.latitude) : "—"}
                mono
              />
              <DataRow
                label="Longitude"
                value={location ? String(location.longitude) : "—"}
                mono
              />
              <div className="rounded-md bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
                <strong className="text-foreground">Remember:</strong> Photon
                uses OpenStreetMap data, and some addresses may be approximate
                or missing. Verify the selected point on a map before using it
                for a delivery.
              </div>
            </CardContent>
          </Card>
        </form>
        <p className="text-xs text-muted-foreground">
          This is a UI/API integration example. It does not create a customer
          record or write to PostgreSQL.
        </p>
      </div>
    </main>
  );
}

function DataRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          mono
            ? "break-all font-mono text-sm"
            : "break-words text-sm font-medium"
        }
      >
        {value}
      </p>
    </div>
  );
}
