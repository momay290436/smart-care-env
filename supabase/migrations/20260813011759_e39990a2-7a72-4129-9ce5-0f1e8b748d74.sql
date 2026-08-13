CREATE INDEX IF NOT EXISTS idx_water_meter_records_date_time ON public.water_meter_records (record_date DESC, record_time DESC);
CREATE INDEX IF NOT EXISTS idx_water_quality_logs_check_date ON public.water_quality_logs (check_date DESC);
CREATE INDEX IF NOT EXISTS idx_water_quality_logs_created_at ON public.water_quality_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wastewater_inspection_logs_check_date ON public.wastewater_inspection_logs (check_date DESC);
CREATE INDEX IF NOT EXISTS idx_wastewater_statistics_logs_record_date ON public.wastewater_statistics_logs (record_date DESC);
CREATE INDEX IF NOT EXISTS idx_sewage_trash_logs_date ON public.sewage_trash_logs (record_date DESC, record_time DESC);
CREATE INDEX IF NOT EXISTS idx_water_pathogen_logs_check_date ON public.water_pathogen_logs (check_date DESC);
CREATE INDEX IF NOT EXISTS idx_water_quality_batches_test_date ON public.water_quality_batches (test_date DESC);