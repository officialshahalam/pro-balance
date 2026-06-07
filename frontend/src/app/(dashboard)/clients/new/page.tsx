"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/api-client/clients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const FIRM_TYPES = [
  "Proprietorship",
  "Partnership Firm",
  "Limited Liability Partnership (LLP)",
  "Private Limited Company",
  "Public Limited Company",
  "One Person Company (OPC)",
  "Hindu Undivided Family (HUF)",
  "Trust",
  "Society",
  "Section 8 Company (Non-Profit)",
  "Co-operative Society",
  "Government Entity",
  "Local Authority",
  "Association of Persons (AOP)",
  "Body of Individuals (BOI)",
  "Foreign Company",
  "Other",
];

import { toast } from "sonner";

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z][Z][0-9A-Z]$/;

export default function NewClientPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [firmType, setFirmType] = useState("");

  const mutation = useMutation({
    mutationFn: createClient,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Client created");
      router.push(`/clients/${data.id}`);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Failed"),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const pan = (fd.get("pan") as string).toUpperCase().trim();
    const gstin = (fd.get("gstin") as string).toUpperCase().trim();

    const newErrors: Record<string, string> = {};
    if (pan && !PAN_REGEX.test(pan)) {
      newErrors.pan = "Invalid PAN format (e.g. ABCDE1234F)";
    }
    if (gstin && !GSTIN_REGEX.test(gstin)) {
      newErrors.gstin = "Invalid GSTIN format (e.g. 22ABCDE1234F1Z5)";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    mutation.mutate({
      name: fd.get("name") as string,
      firm_type: firmType || undefined,
      pan: pan || undefined,
      gstin: gstin || undefined,
      phone: (fd.get("phone") as string) || undefined,
      email: (fd.get("email") as string) || undefined,
      address_line: (fd.get("address_line") as string) || undefined,
      village: (fd.get("village") as string) || undefined,
      post_office: (fd.get("post_office") as string) || undefined,
      city: (fd.get("city") as string) || undefined,
      state: (fd.get("state") as string) || undefined,
      pin_code: (fd.get("pin_code") as string) || undefined,
    });
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mx-auto max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add Client</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="name">Client / Firm Name *</Label>
                <Input id="name" name="name" required autoFocus />
              </div>
              <div className="space-y-1">
                <Label>Firm Type</Label>
                <Select
                  value={firmType}
                  onValueChange={(v) => setFirmType(v ?? "")}
                >
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue placeholder="Select firm type" />
                  </SelectTrigger>
                  <SelectContent className="min-w-72">
                    {FIRM_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="pan">PAN</Label>
                  <Input
                    id="pan"
                    name="pan"
                    placeholder="ABCDE1234F"
                    maxLength={10}
                    className="uppercase"
                    onChange={() =>
                      setErrors((e) => {
                        const { pan, ...rest } = e;
                        return rest;
                      })
                    }
                  />
                  {errors.pan && (
                    <p className="text-xs text-destructive">{errors.pan}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="gstin">GSTIN</Label>
                  <Input
                    id="gstin"
                    name="gstin"
                    placeholder="22ABCDE1234F1Z5"
                    maxLength={15}
                    className="uppercase"
                    onChange={() =>
                      setErrors((e) => {
                        const { gstin, ...rest } = e;
                        return rest;
                      })
                    }
                  />
                  {errors.gstin && (
                    <p className="text-xs text-destructive">{errors.gstin}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="address_line">Address / Street</Label>
                <Input
                  id="address_line"
                  name="address_line"
                  placeholder="Near Aadersh Inter College"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="village">Village / Area</Label>
                  <Input id="village" name="village" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="post_office">Post Office</Label>
                  <Input id="post_office" name="post_office" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="city">City / District</Label>
                  <Input id="city" name="city" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="state">State</Label>
                  <Input id="state" name="state" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pin_code">PIN Code</Label>
                  <Input id="pin_code" name="pin_code" maxLength={6} />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "Creating..." : "Create Client"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
