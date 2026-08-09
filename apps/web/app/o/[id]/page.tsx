import { ObligationPassportPage } from "@/components/demo/obligation-passport-page";

export const metadata = {
  title: "Obligation passport",
  description:
    "Review, confirm, finance, or discharge a LIEN obligation by ID.",
};

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ObligationPage({ params }: Props) {
  const { id } = await params;
  return <ObligationPassportPage obligationIdParam={id} />;
}
