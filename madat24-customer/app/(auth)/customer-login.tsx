import { LoginScreen } from "~/components/shared/AuthScreens";
export default function CustomerLogin() {
  return <LoginScreen role="customer" roleLabel="Customer" icon="User" colors={["#FF6B35","#E04A15"]} subtitle="Get roadside assistance in minutes" signupRoute="/(auth)/customer-signup" dashboardRoute="/(customer)/dashboard" />;
}