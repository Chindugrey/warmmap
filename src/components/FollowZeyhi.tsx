// One plain line under the share buttons. No tracking, no tag on the address, nothing sent to us.
import { ZEYHI_LINKEDIN_URL } from "@/lib/site";

export function FollowZeyhi() {
  return (
    <p className="wm-follow">
      <a href={ZEYHI_LINKEDIN_URL} target="_blank" rel="noopener noreferrer">
        Follow Zeyhi on LinkedIn
      </a>
    </p>
  );
}
