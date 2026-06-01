interface CreatorCreditProps {
  className?: string;
}

export default function CreatorCredit({ className = "" }: CreatorCreditProps) {
  return (
    <span className={`text-[10px] font-medium tracking-wide ${className || "text-muted-foreground/60"}`}>
      Create By: K.Maneewan
    </span>
  );
}
