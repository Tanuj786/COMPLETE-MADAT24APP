import React, { memo } from "react";
import * as icons from "lucide-react-native";
import type { LucideProps } from "lucide-react-native";

type IconName = keyof typeof icons;
type Props = LucideProps & { name: IconName };

const Icon: React.FC<Props> = memo(({ name, ...rest }) => {
  const Component = (icons[name] as React.FC<LucideProps>) ?? icons.HelpCircle;
  return <Component {...rest} />;
});
export default Icon;
