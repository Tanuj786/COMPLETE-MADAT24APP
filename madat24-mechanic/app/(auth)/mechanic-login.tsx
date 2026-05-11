import { LoginScreen } from "~/components/shared/AuthScreens";
export default function MechanicLogin() {
  return <LoginScreen role="mechanic" roleLabel="Mechanic" icon="Wrench" colors={["#3B82F6","#1D4ED8"]} subtitle="Access your service dashboard" signupRoute="/(auth)/mechanic-signup" dashboardRoute="/(mechanic)/dashboard" />;
}