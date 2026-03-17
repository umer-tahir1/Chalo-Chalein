import { createBrowserRouter } from "react-router";
import { RootLayout } from "./components/layouts/RootLayout";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { PassengerDashboard } from "./pages/PassengerDashboard";
import { DriverDashboard } from "./pages/DriverDashboard";
import { AdminDashboard } from "./pages/AdminDashboard";
import { RideHistory } from "./pages/RideHistory";
import { Chat } from "./pages/Chat";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      { index: true, Component: LandingPage },
      { path: "login", Component: LoginPage },
      { path: "signup", Component: SignupPage },
      {
        path: "passenger/dashboard",
        element: (
          <ProtectedRoute allowedRoles={["passenger"]}>
            <PassengerDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: "driver/dashboard",
        element: (
          <ProtectedRoute allowedRoles={["driver"]}>
            <DriverDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: "admin/dashboard",
        element: (
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: "history",
        element: (
          <ProtectedRoute allowedRoles={["passenger", "driver"]}>
            <RideHistory />
          </ProtectedRoute>
        ),
      },
      {
        path: "chat",
        element: (
          <ProtectedRoute allowedRoles={["passenger", "driver"]}>
            <Chat />
          </ProtectedRoute>
        ),
      },
    ],
  },
]);
