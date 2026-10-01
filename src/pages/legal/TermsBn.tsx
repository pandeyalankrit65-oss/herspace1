import { Link } from "react-router-dom";
import LegalPage, { ContactLine, Section } from "@/components/LegalPage";
import { EMERGENCY_NUMBER } from "@/lib/api";

// Bengali translation of the Terms of Use, drafted with AI assistance (have it reviewed by a
// native speaker). Keep it in step with Terms.tsx: the English text is the binding version.
const TermsBn = () => (
  <LegalPage title="ব্যবহারের শর্তাবলি" updated="27 সেপ্টেম্বর 2026" lang="bn">
    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-foreground">
      <strong>HerSpace কোনো জরুরি পরিষেবা নয়।</strong> এটি পুলিশ, অ্যাম্বুলেন্স বা কোনো জরুরি সহায়তা পরিষেবার সঙ্গে যোগাযোগ করে না। বিপদে
      পড়লে{" "}
      <a className="underline" href={`tel:${EMERGENCY_NUMBER}`}>
        {EMERGENCY_NUMBER}
      </a>
      -এ কল করুন।
    </div>

    <Section title="HerSpace কী করে">
      <p>
        HerSpace আপনাকে বিশ্বস্ত মানুষদের সতর্ক করতে, ঘটনা নথিভুক্ত করতে, কমিউনিটির রিপোর্ট করা ঘটনা ম্যাপে দেখতে এবং একটি AI সাপোর্ট
        সঙ্গীর সঙ্গে কথা বলতে দেয়। এটি ব্যবহার করে আপনি এই শর্তাবলি এবং আমাদের{" "}
        <Link to="/privacy" className="text-primary underline">
          গোপনীয়তা নীতিতে
        </Link>{" "}
        সম্মত হচ্ছেন।
      </p>
    </Section>

    <Section title="SOS অ্যালার্ট ব্যর্থ হতে পারে">
      <p>
        টেক্সট মেসেজ ও কল নির্ভর করে ফোন নেটওয়ার্ক, আপনার ইন্টারনেট সংযোগ, আপনার ডিভাইসের অবস্থান এবং তৃতীয় পক্ষের প্রদানকারীদের ওপর।
        প্রতিটি অ্যালার্ট পাঠানো হয়েছে কিনা আমরা দেখাই, কিন্তু অ্যালার্ট পৌঁছাবে, পড়া হবে বা তার ভিত্তিতে ব্যবস্থা নেওয়া হবে, এমন নিশ্চয়তা
        দিতে পারি না। সাহায্য পাওয়ার অন্য একটি উপায় সবসময় রাখুন, এবং আপনার সেটআপ যাচাই করতে টেস্ট অ্যালার্ট ব্যবহার করুন।
      </p>
    </Section>

    <Section title="আপনার দায়িত্ব">
      <ul>
        <li>শুধু সেই মানুষদের জরুরি পরিচিতি হিসেবে যোগ করুন যাঁরা আপনাকে চেনেন এবং আপনার কাছ থেকে অ্যালার্ট পেতে রাজি হয়েছেন।</li>
        <li>মজা করে বা কাউকে হয়রানি করতে SOS চালু করবেন না।</li>
        <li>সৎভাবে ঘটনা রিপোর্ট করুন। মিথ্যা রিপোর্ট বা অন্যদের পরিচয় প্রকাশ করে এমন তথ্য পোস্ট করবেন না।</li>
        <li>আপনার পাসওয়ার্ড গোপন রাখুন, এবং অ্যাকাউন্টের অপব্যবহার হয়েছে মনে হলে আমাদের জানান।</li>
      </ul>
      <p>যে কনটেন্ট বা অ্যাকাউন্ট এই নিয়ম ভাঙে বা অন্যদের ঝুঁকিতে ফেলে, আমরা তা সরিয়ে দিতে বা স্থগিত করতে পারি।</p>
    </Section>

    <Section title="AI সাপোর্ট চ্যাট">
      <p>
        সাপোর্ট সঙ্গীটি একটি AI। এটি ভুল করতে পারে এবং এটি ডাক্তার, থেরাপিস্ট, কাউন্সেলর বা আইনজীবী নয়। চিকিৎসা, আইনি বা জরুরি সিদ্ধান্তের
        জন্য এর ওপর নির্ভর করবেন না।
      </p>
    </Section>

    <Section title="কমিউনিটি ম্যাপ">
      <p>
        ম্যাপের রিপোর্টগুলো অন্য ব্যবহারকারীদের কাছ থেকে আসে এবং যাচাই করা নয়। রিপোর্ট না থাকার মানে এই নয় যে এলাকাটি নিরাপদ, আর একটি
        রিপোর্ট প্রমাণ করে না যে কিছু ঘটেছে।
      </p>
    </Section>

    <Section title="উপলব্ধতা ও পরিবর্তন">
      <p>
        HerSpace সক্রিয়ভাবে তৈরি হচ্ছে। ফিচার বদলাতে পারে, এবং পরিষেবা মাঝে মাঝে অনুপলব্ধ থাকতে পারে। কিছু বদলালে আমরা এই শর্তাবলি আপডেট
        করব এবং নতুন তারিখ ওপরে দেখাব।
      </p>
    </Section>

    <Section title="ব্যবহার বন্ধ করা">
      <p>
        আপনি যেকোনো সময় HerSpace ব্যবহার বন্ধ করতে এবং আপনার{" "}
        <Link to="/account" className="text-primary underline">
          অ্যাকাউন্ট পেজ
        </Link>{" "}
        থেকে অ্যাকাউন্ট মুছে ফেলতে পারেন।
      </p>
    </Section>

    <Section title="যোগাযোগ">
      <ContactLine lang="bn" />
    </Section>
  </LegalPage>
);

export default TermsBn;
