import { SignupScreen } from "~/components/shared/AuthScreens";
export default function CustomerSignup() {
  return <SignupScreen role="customer" roleLabel="Customer" icon="User" colors={["#FF6B35","#E04A15"]} loginRoute="/(auth)/customer-login" dashboardRoute="/(customer)/dashboard" />;
}