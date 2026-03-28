import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="pt-8 pb-8">
          <div className="text-8xl font-bold text-primary/20 mb-4">404</div>
          <h1 className="text-2xl font-bold mb-2">Página no encontrada</h1>
          <p className="text-muted-foreground mb-6">
            Lo sentimos, la página que busca no existe o ha sido movida.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="outline" onClick={() => window.history.back()} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Volver
            </Button>
            <Link href="/">
              <Button className="gap-2 w-full sm:w-auto">
                <Home className="w-4 h-4" />
                Ir al inicio
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
