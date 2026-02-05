
"use client";

import { useEffect, useMemo, useState } from "react";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowUpRight,
  Calendar,
  Eye,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Search,
} from "lucide-react";
import { IBM_Plex_Sans, Sora } from "next/font/google";

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

type EvaluationSourceItem = {
  id: string;
  title: string;
  city: string;
  postDate: number | null;
  priceNumeric: number | null;
  priceFormatted: string | null;
  hasImage: boolean;
  imagesCount: number;
  commentsCount: number;
  tags: string[];
  phone: string;
  url: string;
};

type ListResponse = {
  items: EvaluationSourceItem[];
  total: number;
  page: number;
  limit: number;
};

const animationStyles = `
@keyframes float-slow {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-18px); }
}
@keyframes shimmer {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
.float-slow {
  animation: float-slow 10s ease-in-out infinite;
}
.shimmer-bg {
  background-size: 200% 200%;
  animation: shimmer 12s ease-in-out infinite;
}
`;

const defaultFilters = {
  search: "",
  city: "",
  minPrice: "",
  maxPrice: "",
  hasImage: "any",
  hasPrice: "any",
  dateFrom: "",
  dateTo: "",
  sort: "newest",
};

function formatEpoch(value: number | null) {
  if (!value) return "-";
  const asDate = value > 1_000_000_000_000 ? new Date(value) : new Date(value * 1000);
  if (Number.isNaN(asDate.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(asDate);
}

function formatPrice(value: number | null, formatted?: string | null) {
  if (formatted) return formatted;
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("en-US").format(value);
}

export default function EvaluationSourcePage() {
  const [draftFilters, setDraftFilters] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [data, setData] = useState<ListResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailStatus, setDetailStatus] = useState<"idle" | "loading" | "error">("idle");
  const [detail, setDetail] = useState<Record<string, any> | null>(null);
  const [imagesOpen, setImagesOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [modalStatus, setModalStatus] = useState<"idle" | "loading" | "error">("idle");
  const [modalImages, setModalImages] = useState<string[]>([]);
  const [modalComments, setModalComments] = useState<Array<Record<string, any>>>([]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (appliedFilters.search) params.set("search", appliedFilters.search);
    if (appliedFilters.city) params.set("city", appliedFilters.city);
    if (appliedFilters.minPrice) params.set("minPrice", appliedFilters.minPrice);
    if (appliedFilters.maxPrice) params.set("maxPrice", appliedFilters.maxPrice);
    if (appliedFilters.hasImage !== "any") params.set("hasImage", appliedFilters.hasImage);
    if (appliedFilters.hasPrice !== "any") params.set("hasPrice", appliedFilters.hasPrice);
    if (appliedFilters.dateFrom) params.set("dateFrom", appliedFilters.dateFrom);
    if (appliedFilters.dateTo) params.set("dateTo", appliedFilters.dateTo);
    if (appliedFilters.sort) params.set("sort", appliedFilters.sort);
    params.set("page", String(page));
    params.set("limit", String(limit));
    return params.toString();
  }, [appliedFilters, page, limit]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setStatus("loading");
      setError(null);
      try {
        const response = await fetch(`/api/haraj-scrape?${queryString}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error("Failed to fetch evaluation source data.");
        }
        const result = (await response.json()) as ListResponse;
        if (active) {
          setData(result);
          setStatus("idle");
        }
      } catch (err) {
        if (active) {
          setStatus("error");
          setError(err instanceof Error ? err.message : "Unexpected error.");
        }
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [queryString]);

  const items = data?.items ?? [];
  const totalPages = Math.max(Math.ceil((data?.total ?? 0) / limit), 1);

  const cityOptions = useMemo(() => {
    return Array.from(new Set(items.map((item) => item.city).filter(Boolean))).sort();
  }, [items]);

  const applyFilters = () => {
    setAppliedFilters(draftFilters);
    setPage(1);
  };

  const resetFilters = () => {
    setDraftFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    setPage(1);
  };

  const fetchDetail = async (itemId: string) => {
    const response = await fetch(`/api/haraj-scrape/${encodeURIComponent(itemId)}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error("Unable to load document details.");
    }
    return (await response.json()) as Record<string, any>;
  };

  const openDetails = async (itemId: string) => {
    setDetailOpen(true);
    setDetailStatus("loading");
    setDetail(null);
    try {
      const doc = await fetchDetail(itemId);
      setDetail(doc);
      setDetailStatus("idle");
    } catch (err) {
      setDetailStatus("error");
    }
  };

  const openImages = async (itemId: string) => {
    setImagesOpen(true);
    setModalStatus("loading");
    setModalImages([]);
    try {
      const doc = await fetchDetail(itemId);
      const images = (doc?.item?.imagesList ?? doc?.imagesList ?? []) as string[];
      setModalImages(images);
      setModalStatus("idle");
    } catch (err) {
      setModalStatus("error");
    }
  };

  const openComments = async (itemId: string) => {
    setCommentsOpen(true);
    setModalStatus("loading");
    setModalComments([]);
    try {
      const doc = await fetchDetail(itemId);
      const comments =
        (doc?.comments ??
          doc?.gql?.comments?.json?.data?.comments?.items ??
          []) as Array<Record<string, any>>;
      setModalComments(comments);
      setModalStatus("idle");
    } catch (err) {
      setModalStatus("error");
    }
  };

  const detailImages = (detail?.item?.imagesList ?? []) as string[];
  const detailTags = (detail?.tags ?? detail?.item?.tags ?? []) as string[];
  const detailComments = (detail?.comments ?? []) as Array<Record<string, any>>;

  return (
    <div className={`min-h-screen bg-[#f7f4ee] text-slate-900 ${plex.className}`}>
      <style>{animationStyles}</style>
      <Header />
      <main className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-16 right-10 h-48 w-48 rounded-full bg-amber-200/40 blur-3xl float-slow" />
          <div
            className="absolute top-1/3 -left-10 h-56 w-56 rounded-full bg-cyan-200/50 blur-3xl float-slow"
            style={{ animationDelay: "-4s" }}
          />
          <div
            className="absolute bottom-20 right-1/3 h-64 w-64 rounded-full bg-rose-200/40 blur-3xl float-slow"
            style={{ animationDelay: "-7s" }}
          />
        </div>

        {/* <section className="relative">
          <div className="w-full px-6 py-12">
            <div className="space-y-6">
                <Badge className="bg-slate-900 text-white px-4 py-2 text-xs uppercase tracking-[0.35em]">
                  Evaluation Source
                </Badge>
                <div className={`text-4xl md:text-5xl font-semibold leading-tight ${sora.className}`}>
                  Evaluation Source
                </div>
            </div>
          </div>
        </section> */}

        <section className="relative pb-16">
          <div className="w-full px-6">
            <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-2xl backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className={`text-xl font-semibold ${sora.className}`}>Filter and refine</h2>
                  <p className="text-sm text-slate-500">Precision controls to reach the exact evaluation source.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800" onClick={applyFilters}>
                    Apply filters
                  </Button>
                  <Button size="sm" variant="outline" onClick={resetFilters}>
                    Reset
                  </Button>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={draftFilters.search}
                      onChange={(event) => setDraftFilters({ ...draftFilters, search: event.target.value })}
                      placeholder="Title, seller, phone"
                      className="pl-9 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">City</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      list="city-options"
                      value={draftFilters.city}
                      onChange={(event) => setDraftFilters({ ...draftFilters, city: event.target.value })}
                      placeholder="Search city"
                      className="pl-9 text-sm"
                    />
                    <datalist id="city-options">
                      {cityOptions.map((city) => (
                        <option key={city} value={city} />
                      ))}
                    </datalist>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Price range</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={draftFilters.minPrice}
                      onChange={(event) => setDraftFilters({ ...draftFilters, minPrice: event.target.value })}
                      placeholder="Min"
                      className="text-sm"
                    />
                    <Input
                      value={draftFilters.maxPrice}
                      onChange={(event) => setDraftFilters({ ...draftFilters, maxPrice: event.target.value })}
                      placeholder="Max"
                      className="text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Has images</Label>
                  <div className="flex items-center gap-3 rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <Checkbox
                      id="has-images"
                      checked={draftFilters.hasImage === "true"}
                      onCheckedChange={(checked) =>
                        setDraftFilters({ ...draftFilters, hasImage: checked ? "true" : "any" })
                      }
                    />
                    <Label htmlFor="has-images" className="text-sm font-normal text-slate-600">
                      Show only records with images
                    </Label>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Has price</Label>
                  <div className="flex items-center gap-3 rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <Checkbox
                      id="has-price"
                      checked={draftFilters.hasPrice === "true"}
                      onCheckedChange={(checked) =>
                        setDraftFilters({ ...draftFilters, hasPrice: checked ? "true" : "any" })
                      }
                    />
                    <Label htmlFor="has-price" className="text-sm font-normal text-slate-600">
                      Show only records with price
                    </Label>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Date from</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="date"
                      value={draftFilters.dateFrom}
                      onChange={(event) => setDraftFilters({ ...draftFilters, dateFrom: event.target.value })}
                      className="pl-9 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Date to</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="date"
                      value={draftFilters.dateTo}
                      onChange={(event) => setDraftFilters({ ...draftFilters, dateTo: event.target.value })}
                      className="pl-9 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Sort by</Label>
                  <Select
                    value={draftFilters.sort}
                    onValueChange={(value) => setDraftFilters({ ...draftFilters, sort: value })}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Newest" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest</SelectItem>
                      <SelectItem value="oldest">Oldest</SelectItem>
                      <SelectItem value="price-high">Price high</SelectItem>
                      <SelectItem value="price-low">Price low</SelectItem>
                      <SelectItem value="comments">Most comments</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="mt-8 rounded-3xl border border-slate-200 bg-white/95 shadow-2xl">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-slate-900 text-white px-3 py-2 text-xs uppercase tracking-[0.25em]">
                    Table
                  </div>
                  <p className="text-sm text-slate-500">
                    Showing {items.length} records (page {page} of {totalPages})
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Select
                    value={String(limit)}
                    onValueChange={(value) => {
                      setLimit(Number(value));
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="h-9 w-[120px] text-xs">
                      <SelectValue placeholder="Rows" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 rows</SelectItem>
                      <SelectItem value="25">25 rows</SelectItem>
                      <SelectItem value="50">50 rows</SelectItem>
                      <SelectItem value="100">100 rows</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="px-6 py-4">
                {status === "loading" ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading evaluation source data...
                  </div>
                ) : status === "error" ? (
                  <div className="text-sm text-rose-500">{error ?? "Unable to load data."}</div>
                ) : items.length === 0 ? (
                  <div className="text-sm text-slate-500">No records found for this filter set.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[11px] uppercase tracking-[0.18em]">Title</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-[0.18em]">City</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-[0.18em]">Price</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-[0.18em]">Date</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-[0.18em]">Images</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-[0.18em]">Comments</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-[0.18em]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-sm font-medium text-slate-900">
                            <div className="space-y-1">
                              <p className="line-clamp-2 max-w-[280px]">{item.title}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">{item.city || "-"}</TableCell>
                          <TableCell className="text-sm text-slate-600">
                            {formatPrice(item.priceNumeric, item.priceFormatted)}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">{formatEpoch(item.postDate)}</TableCell>
                          <TableCell className="text-sm text-slate-600">
                            {item.imagesCount > 0 ? (
                              <button
                                type="button"
                                onClick={() => openImages(item.id)}
                                className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
                              >
                                <ImageIcon className="h-3 w-3" />
                                View images ({item.imagesCount})
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-400">
                                <ImageIcon className="h-3 w-3" />
                                No images
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600">
                            {item.commentsCount > 0 ? (
                              <button
                                type="button"
                                onClick={() => openComments(item.id)}
                                className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
                              >
                                {item.commentsCount} comments
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-400">
                                0 comments
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-3">
                              <Button
                                size="sm"
                                className="h-8 gap-2 bg-slate-900 text-white hover:bg-slate-800"
                                onClick={() => openDetails(item.id)}
                              >
                                <Eye className="h-4 w-4" />
                                See more
                              </Button>
                              {item.url ? (
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
                                >
                                  Open source
                                  <ArrowUpRight className="h-3 w-3" />
                                </a>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 px-6 py-4 text-xs text-slate-500">
                <div>
                  Showing page {page} of {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((prev) => Math.max(prev - 1, 1))}>
                    Previous
                  </Button>
                  <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}>
                    Next
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Dialog open={imagesOpen} onOpenChange={setImagesOpen}>
          <DialogContent className="max-w-3xl border border-slate-200 bg-white/95 p-0">
            <DialogHeader className="border-b border-slate-200 px-6 py-4">
              <DialogTitle className={`text-2xl font-semibold ${sora.className}`}>Images</DialogTitle>
              <p className="text-sm text-slate-500">Scroll to view all listing images.</p>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-4 p-6">
                {modalStatus === "loading" ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading images...
                  </div>
                ) : modalStatus === "error" ? (
                  <p className="text-sm text-rose-500">Unable to load images.</p>
                ) : modalImages.length === 0 ? (
                  <p className="text-sm text-slate-500">No images available.</p>
                ) : (
                  modalImages.map((src, index) => (
                    <div key={`${src}-${index}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <img src={src} alt="Listing" className="w-full object-cover" loading="lazy" />
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        <Dialog open={commentsOpen} onOpenChange={setCommentsOpen}>
          <DialogContent className="max-w-3xl border border-slate-200 bg-white/95 p-0">
            <DialogHeader className="border-b border-slate-200 px-6 py-4">
              <DialogTitle className={`text-2xl font-semibold ${sora.className}`}>Comments</DialogTitle>
              <p className="text-sm text-slate-500">Full comment history for this listing.</p>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-4 p-6">
                {modalStatus === "loading" ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading comments...
                  </div>
                ) : modalStatus === "error" ? (
                  <p className="text-sm text-rose-500">Unable to load comments.</p>
                ) : modalComments.length === 0 ? (
                  <p className="text-sm text-slate-500">No comments recorded.</p>
                ) : (
                  modalComments.map((comment, index) => (
                    <div key={`${comment.id ?? index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                      <p className="text-xs text-slate-400">{comment.authorUsername ?? "Anonymous"}</p>
                      <p className="mt-2 whitespace-pre-line">{comment.body ?? "-"}</p>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-7xl w-[94vw] border border-slate-200 bg-white/95 p-0">
            <DialogHeader className="border-b border-slate-200 px-6 py-4">
              <DialogTitle className={`text-2xl font-semibold ${sora.className}`}>Evaluation Source Detail</DialogTitle>
              <p className="text-sm text-slate-500">Full record insights with structured sections.</p>
            </DialogHeader>
            <ScrollArea className="max-h-[80vh]">
              <div className="grid gap-6 p-6 lg:grid-cols-[0.22fr_0.78fr]">
                <div className="space-y-4">
                  <div className="rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4 shadow-lg">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Images</p>
                    <div className="mt-4 max-h-[60vh] space-y-3 overflow-y-auto pr-2">
                      {detailImages.length === 0 ? (
                        <span className="text-xs text-slate-500">No images available.</span>
                      ) : (
                        detailImages.map((src, index) => (
                          <div
                            key={`${src}-${index}`}
                            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                          >
                            <img src={src} alt="Listing" className="w-full object-cover" loading="lazy" />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Summary</p>
                    {detailStatus === "loading" ? (
                      <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading details...
                      </div>
                    ) : detailStatus === "error" ? (
                      <p className="mt-3 text-sm text-rose-500">Unable to load details.</p>
                    ) : detail ? (
                      <div className="mt-4 overflow-x-auto">
                        <div className="flex items-center gap-4 text-sm text-slate-700 whitespace-nowrap">
                          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1">
                            <span className="text-xs text-slate-400">Title</span>
                            <span className="font-medium text-slate-900">{detail?.title ?? detail?.item?.title ?? "-"}</span>
                          </div>
                          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1">
                            <span className="text-xs text-slate-400">City</span>
                            <span className="font-medium text-slate-900">
                              {detail?.city ?? detail?.item?.city ?? detail?.item?.geoCity ?? "-"}
                            </span>
                          </div>
                          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1">
                            <span className="text-xs text-slate-400">Price</span>
                            <span className="font-medium text-slate-900">
                              {formatPrice(detail?.priceNumeric ?? detail?.item?.price?.numeric ?? null, detail?.item?.price?.formattedPrice ?? null)}
                            </span>
                          </div>
                          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1">
                            <span className="text-xs text-slate-400">Phone</span>
                            <span className="font-medium text-slate-900">{detail?.phone ?? "-"}</span>
                          </div>
                          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1">
                            <span className="text-xs text-slate-400">Source</span>
                            {detail?.url ? (
                              <a
                                href={detail.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 font-medium text-slate-900 hover:text-slate-950"
                              >
                                Open listing <ArrowUpRight className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="font-medium text-slate-900">-</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Tags</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {detailTags.length === 0 ? (
                        <span className="text-xs text-slate-500">No tags listed.</span>
                      ) : (
                        detailTags.map((tag) => (
                          <span key={tag} className="rounded-full bg-slate-900/10 px-3 py-1 text-[11px] text-slate-700">
                            {tag}
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Notes</p>
                    <p className="mt-3 text-sm text-slate-600 whitespace-pre-line">
                      {detail?.item?.bodyTEXT ?? detail?.item?.bodyHTML ?? "No detailed description provided."}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Comments</p>
                    <div className="mt-3 space-y-3">
                      {detailComments.length === 0 ? (
                        <span className="text-xs text-slate-500">No comments recorded.</span>
                      ) : (
                        detailComments.slice(0, 6).map((comment, index) => (
                          <div
                            key={`${comment.id ?? index}`}
                            className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600"
                          >
                            <p className="text-xs text-slate-400">{comment.authorUsername ?? "Anonymous"}</p>
                            <p className="mt-1 whitespace-pre-line">{comment.body ?? "-"}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </main>
      <Footer />
    </div>
  );
}
