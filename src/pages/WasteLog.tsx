import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format, startOfDay, startOfWeek, startOfMonth } from "date-fns";
import { th } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid, BarChart, Bar, Area, AreaChart } from "recharts";
import PageHeader from "@/components/PageHeader";
import { Plus, Download, Pencil, Trash2, CalendarIcon } from "lucide-react";
import * as XLSX from "xlsx";

const DEFAULT_WASTE_TYPES: Record<string, { label: string; color: string; chartColor: string }> = {
  general: { label: "ขยะทั่วไป", color: "bg-slate-200 text-slate-800 border-slate-300", chartColor: "#057971" },
  infectious: { label: "ขยะติดเชื้อ", color: "bg-red-200 text-red-900 border-red-300", chartColor: "#c50915" },
  recycle: { label: "ขยะรีไซเคิล", color: "bg-emerald-200 text-emerald-900 border-emerald-300", chartColor: "#007bc1" },
  hazardous: { label: "ขยะอันตราย", color: "bg-amber-200 text-amber-900 border-amber-300", chartColor: "#7627ff" },
  organic: { label: "ขยะเปียก", color: "bg-emerald-100 text-emerald-900 border-emerald-200",
