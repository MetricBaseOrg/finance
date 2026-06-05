import { Topnav } from "@/components/mb/Topnav";
import { Eyebrow } from "@/components/mb/Eyebrow";
import { OnboardingForm } from "./OnboardingForm";

export default function OnboardingPage() {
  return (
    <>
      <Topnav sectionLabel="Onboarding" />
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-xl flex flex-col gap-8">
          <div className="flex flex-col gap-3 text-center">
            <Eyebrow>Step 1 of 1</Eyebrow>
            <h1 className="font-sans text-3xl md:text-4xl font-extrabold text-white">
              Create your first workspace
            </h1>
            <p className="text-gray-2 text-sm max-w-md mx-auto">
              A workspace is a separate set of books. Pick{" "}
              <span className="text-gold">Individual</span> for your personal
              finances or <span className="text-gold">Company</span> for a
              business. You can create more later.
            </p>
          </div>
          <OnboardingForm />
        </div>
      </main>
    </>
  );
}
