import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl text-yellow font-display">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">Página não encontrada.</p>
        <Link to="/" className="btn-yellow hover:btn-yellow-hover mt-6 inline-block">
          Voltar
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error }: { error: Error }) {
  console.error(error);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <a href="/" className="btn-yellow mt-6 inline-block">Início</a>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#000000" },
      { title: "OrçaAr Condicionado Pro — Gestão profissional de climatização" },
      { name: "description", content: "Painel premium para técnicos de climatização: orçamentos, aprovações, recebíveis e lucro do mês em um só lugar." },
      { property: "og:title", content: "OrçaAr Condicionado Pro — Gestão profissional de climatização" },
      { name: "twitter:title", content: "OrçaAr Condicionado Pro — Gestão profissional de climatização" },
      { property: "og:description", content: "Painel premium para técnicos de climatização: orçamentos, aprovações, recebíveis e lucro do mês em um só lugar." },
      { name: "twitter:description", content: "Painel premium para técnicos de climatização: orçamentos, aprovações, recebíveis e lucro do mês em um só lugar." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/3cd1fb78-441a-4e15-acce-0bcaf3cd3464/id-preview-ba5f5a16--5e88b46d-a47b-4ba5-9ec5-27fa8ed2f4c6.lovable.app-1781300491487.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/3cd1fb78-441a-4e15-acce-0bcaf3cd3464/id-preview-ba5f5a16--5e88b46d-a47b-4ba5-9ec5-27fa8ed2f4c6.lovable.app-1781300491487.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster theme="dark" position="top-center" richColors />
    </QueryClientProvider>
  );
}
