import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Phone, MapPin, Users, ClipboardList, BookOpen, Flame, AlertTriangle, Plus, Edit, Trash2 } from "lucide-react";
import { useWayfindingGraph, dijkstra, type RouteResult } from "@/hooks/useWayfindingGraph";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";

const BUILDINGS = ["OPD", "IPD ชาย", "IPD หญิง", "คลังยา", "หน่วยจ่ายกลาง", "อาคารซ่อมบำรุง", "โรงไฟฟ้า", "คลังพัสดุ", "อาคารอำนวยการ", "อาคารแพทย์แผนไทย", "อาคารโภชนาการ", "อาคารซักฟอก"];
const FLOORS = ["ชั้น 1", "ชั้น 2", "ชั้น 3"];

const INTERNAL_CONTACTS = [
  { name: "ศูนย์โทรศัพท์ / วิทยุสื่อสาร", numbers: ["0", "187", "176"] },
  { name: "ห้องอุบัติเหตุและฉุกเฉิน (ER)", numbers: ["108"] },
  { name: "หน่วยรักษาความปลอดภัย (รปภ.)", numbers: ["175", "181"] },
];
const EXTERNAL_CONTACTS = [
  { name: "แจ้งเหตุไฟไหม้", numbers: ["199"] },
  { name: "อบต.แม่พริก", numbers: ["0-5378-6368"] },
  { name: "เทศบาลตำบลแม่สรวย", numbers: ["0-5365-6050"] },
  { name: "สภ.อ.แม่สรวย", numbers: ["0-5373-2602"] },
  { name: "การไฟฟ้าอ.แม่สรวย", numbers: ["0-5378-6106"] },
];

const OPERATION_UNITS = [
  { name: "กองอำนวยการ", duty: "กำหนดนโยบาย อำนวยการดับเพลิง ประเมินสถานการณ์ ประสานงานหน่วยงานภายนอก" },
  { name: "หน่วยสื่อสารประชาสัมพันธ์", duty: "ประกาศแจ้งเหตุ ประสานงานหน่วยงานต่างๆ แจ้งผู้ป่วยและญาติ" },
  { name: "หน่วยรักษาความสงบ", duty: "ปิดกั้นการจราจร ควบคุมบริเวณเกิดเหตุ รักษาความปลอดภัย" },
  { name: "หน่วยดับเพลิง/ค้นหา", duty: "ดับเพลิงเบื้องต้น ช่วยเหลือผู้ตกอยู่ในเขตเพลิง จำกัดเขตเพลิงไหม้" },
  { name: "หน่วยเคลื่อนย้ายผู้
