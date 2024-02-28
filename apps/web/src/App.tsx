import { QueryClientProvider } from "@tanstack/react-query";
import { trpc, trpcReactClient } from "./lib/trpc";
import { RouterProvider } from "@tanstack/react-router";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { router } from "./router";
import { queryClient } from "./lib/query";

const InnerApp = () => {
  return <RouterProvider router={router} />;
};

function App() {
  return (
    <trpc.Provider client={trpcReactClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <InnerApp />
        <ReactQueryDevtools />
      </QueryClientProvider>
    </trpc.Provider>
  );
}

export default App;
