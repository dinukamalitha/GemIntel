import FeatureIdentification from '../identification/page';

// Standalone 4C tester — same cut/color/clarity UI as Identification, but
// decoupled from the authentication flow. Upload an image, get all three.
export default function FourCTestPage() {
  return <FeatureIdentification standalone />;
}
