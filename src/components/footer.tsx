"use client";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from 'next/navigation'
import Analytics from "@/app/analytics";

export default function Footer() {
  const searchParams = useSearchParams()
  
  if (searchParams?.get('embed') !== null) return null
  return (
    <footer className="flex-none footer p-5 mt-5 bg-gray-800 text-neutral-content flex place-content-evenly">
      <div className="text-center pt-5  font-bold">
        <ul>
          <li>
            <Link href="mailto:avi.maayan@mssm.edu" target="_blank">
              Contact Us
            </Link>
          </li>
          <li>
            <Link
              href="https://github.com/MaayanLab/PerturbSeqr"
              target="_blank"
              rel="noopener noreferrer"
            >
              Source Code
            </Link>
          </li>
        </ul>
      </div>
      <div className="text-center">
        <p>
          <Link
            href="https://labs.icahn.mssm.edu/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              src={"/images/ismms_white.png"}
              width={150}
              height={250}
              alt={"Ma&apos;ayan Lab"}
            />
          </Link>
        </p>
      </div>
      <div className="text-center pt-5">
        <p>
          <Link
            href="https://labs.icahn.mssm.edu/maayanlab/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className={"rounded"}
              src={"/images/maayanlab_white.png"}
              width={125}
              height={250}
              alt={"Ma&apos;ayan Lab"}
            />
          </Link>
        </p>
      </div>
      <div className="text-center pt-5 text-md font-bold">
        <ul>
          <li>
            <Link
              href="https://github.com/MaayanLab/PerturbSeqr/blob/main/LICENSE"
              target="_blank"
            >
              License
            </Link>
          </li>
        </ul>
      </div>
      <Analytics />
    </footer>
  );
}
