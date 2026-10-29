import { ErrorScreen } from "@/app/components/shared/ErrorScreen";

export default function NotFound() {
  return (
    <ErrorScreen code="404" title="Nothing sealed here.">
      The page you asked for does not exist, or has moved.
    </ErrorScreen>
  );
}
