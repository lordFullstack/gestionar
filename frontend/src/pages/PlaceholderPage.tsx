import { Construction } from 'lucide-react';

export function PlaceholderPage({ titulo }: { titulo: string }) {
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
        <Construction className="h-6 w-6 text-muted-foreground" />
      </div>
      <h1 className="text-lg font-semibold">{titulo}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Esta pantalla todavía no está construida. El backend ya está listo — esto queda para una próxima sesión.
      </p>
    </div>
  );
}
