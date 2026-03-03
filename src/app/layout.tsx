import "./globals.css";
import React from "react";
import type { Metadata } from "next";
import { ApolloWrapper } from "@/lib/apollo/provider";
import { RuntimeConfig } from "@/app/runtimeConfig";
import Header from "@/components/header";
import Footer from "@/components/footer";

export const metadata: Metadata = {
  title: "Perturb-Seqr",
  description: "Perturb-Seqr",
  keywords: [
    "big data",
    "bioinformatics",
    "bone",
    "cancer",
    "cell line",
    "data ecosystem",
    "data portal",
    "data",
    "dataset",
    "diabetes",
    "disease",
    "drug discovery",
    "drug",
    "enrichment analysis",
    "gene set library",
    "gene set",
    "gene",
    "genomics",
    "heart",
    "kidney",
    "knowledge",
    "literature mining",
    "literature",
    "liver",
    "machine learning",
    "neurons",
    "papers",
    "peturbation",
    "pharmacology",
    "phenotype",
    "pmc",
    "protein",
    "proteomics",
    "publications",
    "pubmed",
    "RNA-seq",
    "RNAseq",
    "scRNA-seq",
    "single cell",
    "skin",
    "systems biology",
    "target discovery",
    "target",
    "therapeutics",
    "tissue",
    "transcriptomics",
    "L1000",
    "LINCS",
  ].join(", "),
  metadataBase: new URL("https://perturbseqr.k8s.dev.maayanlab.cloud"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Perturb-Seqr",
    description:
      "Search through 646,250 gene sets created from 12 Connectivity Mapping resources that performed massive single perturbations followed by expression experiments in human cells",
    url: "https://perturbseqr.k8s.dev.maayanlab.cloud",
    siteName: "Perturb-Seqr",
    images: [
      {
        url: "https://perturbseqr.k8s.dev.maayanlab.cloud/images/perturbseqr-logo.png",
        width: 1024,
        height: 998,
      },
    ],
    locale: "en_US",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function RootLayout({
  children,
  jsonld,
}: {
  children: React.ReactNode;
  jsonld?: React.ReactNode;
}) {
  return (
    <html lang="en" style={{ minWidth: "580px" }}>
      <head>{jsonld}</head>
      <ApolloWrapper>
        <RuntimeConfig>
          <body className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900 dark:text-white">
            <React.Suspense fallback={null}>
              <Header />
              <main className="flex-1 flex-col justify-stretch mx-8 md:mx-32">
                <React.Suspense
                  fallback={
                    <span className="loading loading-ring loading-lg"></span>
                  }
                >
                  {children}
                </React.Suspense>
              </main>
              <Footer/>
            </React.Suspense>
          </body>
        </RuntimeConfig>
      </ApolloWrapper>
    </html>
  );
}
