"use client";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getClients,
  deleteClient,
  updateClient,
  type Client,
} from "@/lib/api-client/clients";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { confirm } from "@/components/ui/confirm-dialog";

const PAGE_SIZE = 20;

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

export default function ClientsPage() {
  const router = useRouter();
  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: getClients,
  });
  const qc = useQueryClient();

  const deleteMut = useMutation({
    mutationFn: deleteClient,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Client deleted");
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Partial<Client>) =>
      updateClient(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      setEditClient(null);
      toast.success("Client updated");
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.message || "Update failed"),
  });

  const [search, setSearch] = useState("");
  const [firmTypeFilter, setFirmTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [editFirmType, setEditFirmType] = useState("");

  const firmTypes = useMemo(() => {
    if (!clients) return [];
    const types = [
      ...new Set(clients.map((c) => c.firm_type).filter(Boolean)),
    ] as string[];
    return types.sort();
  }, [clients]);

  const filtered = useMemo(() => {
    if (!clients) return [];
    return clients.filter((c) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.pan?.toLowerCase().includes(q) ||
        c.gstin?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q);
      const matchesFirmType =
        firmTypeFilter === "all" || c.firm_type === firmTypeFilter;
      return matchesSearch && matchesFirmType;
    });
  }, [clients, search, firmTypeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
  };
  const handleFilter = (val: string) => {
    setFirmTypeFilter(val);
    setPage(1);
  };

  const openEdit = (c: Client) => {
    setEditClient(c);
    setEditFirmType(c.firm_type || "");
  };

  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editClient) return;
    const fd = new FormData(e.currentTarget);
    updateMut.mutate({
      id: editClient.id,
      name: fd.get("name") as string,
      firm_type: editFirmType || undefined,
      pan: (fd.get("pan") as string).toUpperCase() || undefined,
      gstin: (fd.get("gstin") as string).toUpperCase() || undefined,
      phone: (fd.get("phone") as string) || undefined,
      email: (fd.get("email") as string) || undefined,
      address_line: (fd.get("address_line") as string) || undefined,
      city: (fd.get("city") as string) || undefined,
      state: (fd.get("state") as string) || undefined,
      pin_code: (fd.get("pin_code") as string) || undefined,
    });
  };

  if (isLoading)
    return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold">Clients</h1>
          <Link href="/clients/new">
            <Button size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              Add Client
            </Button>
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-50 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, PAN, GSTIN, email, phone..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="h-9 pl-8 text-sm"
            />
          </div>
          {firmTypes.length > 0 && (
            <Select
              value={firmTypeFilter}
              onValueChange={(v) => handleFilter(v ?? "all")}
            >
              <SelectTrigger className="h-9 w-45 text-sm">
                <SelectValue placeholder="Firm Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Firm Types</SelectItem>
                {firmTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {!clients?.length ? (
        <div className="px-6 text-sm text-muted-foreground">
          No clients yet. Add your first client to get started.
        </div>
      ) : filtered.length === 0 ? (
        <div className="px-6 text-sm text-muted-foreground">
          No clients match your search.
        </div>
      ) : (
        <>
          <div className="flex-1 mx-6 my-6 overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-[30%] font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                    Client Name
                  </TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                    Firm Type
                  </TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                    PAN
                  </TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                    GSTIN
                  </TableHead>
                  <TableHead className="text-center font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                    FYs
                  </TableHead>
                  <TableHead className="w-12 text-center font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/clients/${c.id}`)}
                  >
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {c.firm_type || "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {c.pan || "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {c.gstin || "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {c._count?.financial_years ?? 0}
                    </TableCell>
                    <TableCell
                      className="text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted">
                          <MoreVertical className="h-4 w-4 text-muted-foreground" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(c)}>
                            <Pencil className="mr-2 h-3.5 w-3.5" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={async () => {
                              if (
                                await confirm({
                                  title: "Delete Client",
                                  description: `Delete "${c.name}" and all their financial data? This cannot be undone.`,
                                  confirmLabel: "Delete",
                                  destructive: true,
                                })
                              )
                                deleteMut.mutate(c.id);
                            }}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t p-6 text-sm text-muted-foreground">
            <span>
              Showing {(page - 1) * PAGE_SIZE + 1} to{" "}
              {Math.min(page * PAGE_SIZE, filtered.length)} of{" "}
              <span className="font-medium text-foreground">
                {filtered.length}
              </span>{" "}
              results
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="px-2 min-w-8 text-center font-medium text-foreground">
                {page}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Edit Client Dialog */}
      <Dialog
        open={!!editClient}
        onOpenChange={(open) => {
          if (!open) setEditClient(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
          </DialogHeader>
          {editClient && (
            <form onSubmit={handleEditSubmit} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="edit-name">Client / Firm Name *</Label>
                <Input
                  id="edit-name"
                  name="name"
                  required
                  defaultValue={editClient.name}
                />
              </div>
              <div className="space-y-1">
                <Label>Firm Type</Label>
                <Select
                  value={editFirmType}
                  onValueChange={(v) => setEditFirmType(v ?? "")}
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
                  <Label htmlFor="edit-pan">PAN</Label>
                  <Input
                    id="edit-pan"
                    name="pan"
                    defaultValue={editClient.pan || ""}
                    maxLength={10}
                    className="uppercase"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-gstin">GSTIN</Label>
                  <Input
                    id="edit-gstin"
                    name="gstin"
                    defaultValue={editClient.gstin || ""}
                    maxLength={15}
                    className="uppercase"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="edit-phone">Phone</Label>
                  <Input
                    id="edit-phone"
                    name="phone"
                    defaultValue={editClient.phone || ""}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    name="email"
                    type="email"
                    defaultValue={editClient.email || ""}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-address_line">Address / Street</Label>
                <Input
                  id="edit-address_line"
                  name="address_line"
                  defaultValue={editClient.address_line || ""}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="edit-city">City</Label>
                  <Input
                    id="edit-city"
                    name="city"
                    defaultValue={editClient.city || ""}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-state">State</Label>
                  <Input
                    id="edit-state"
                    name="state"
                    defaultValue={editClient.state || ""}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-pin_code">PIN Code</Label>
                  <Input
                    id="edit-pin_code"
                    name="pin_code"
                    defaultValue={editClient.pin_code || ""}
                    maxLength={6}
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={updateMut.isPending}>
                  {updateMut.isPending ? "Saving..." : "Save Changes"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditClient(null)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
