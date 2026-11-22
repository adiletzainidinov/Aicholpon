import InvitationExperience from '@/components/invitation/InvitationExperience';
import { LiteFlowers } from '@/components/invitation/LiteFlowers';
import { DateScene, FinalScene, Hero, InvitationText, RSVPScene, VenueScene } from '@/components/invitation/Sections';

/**
 * Static shell (prerendered): the copy, calendar and structure are server components;
 * only the interactive islands (3D scene, countdown, RSVP, share) hydrate on the client.
 * Personal data (guest name via ?token=…) is fetched client-side through a no-store API,
 * so the page itself stays publicly cacheable and old links keep working.
 */
export default function Page() {
  return (
    <InvitationExperience liteDecor={<LiteFlowers />}>
      <Hero />
      <InvitationText />
      <DateScene />
      <VenueScene />
      <RSVPScene />
      <FinalScene />
    </InvitationExperience>
  );
}
