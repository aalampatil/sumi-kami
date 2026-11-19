"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Enso, InkLandscape } from "~/components/brand/ink-art";
export function HeroPreview() {
  const [rating, setRating] = useState("4");
  return (
    <div className="ink-hero-art relative mx-auto w-full max-w-lg py-6">
      <Enso className="hero-enso" />
      <InkLandscape className="hero-landscape" />
      <div className="hero-paper relative rotate-[-2deg] rounded-sm border border-[#c9bfae] bg-[#fcfaf6] p-6 text-[#171714] sm:p-9">
        <div className="flex items-center justify-between border-b border-[#d8d0c3] pb-4 text-xs">
          <span className="font-medium">THE SMALL THINGS STUDIO</span>
          <span className="text-[#68645d]">Example form</span>
        </div>
        <p className="mt-8 font-serif text-3xl leading-tight sm:text-4xl">
          Good things start
          <br />
          with a question.
        </p>
        <p className="mt-4 text-sm leading-7 text-[#68645d]">
          A small check-in. A little space to be heard.
        </p>
        <fieldset className="mt-7">
          <legend className="text-sm font-medium">How was your experience?</legend>
          <div className="mt-3 flex gap-2">
            {["1", "2", "3", "4", "5"].map((value) => (
              <label
                key={value}
                className={
                  "rating-option relative flex size-11 cursor-pointer items-center justify-center rounded-sm border text-sm " +
                  (rating === value
                    ? "border-[#9f382c] bg-[#9f382c] text-white"
                    : "border-[#827a6e]")
                }
              >
                <input
                  aria-label={value + " out of 5"}
                  type="radio"
                  name="hero-rating"
                  className="absolute inset-0 size-full cursor-pointer opacity-0"
                  checked={rating === value}
                  onChange={() => setRating(value)}
                />
                <span aria-hidden="true">{value}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Link
          href="/demo"
          className="mt-8 inline-flex min-h-12 w-full items-center justify-between gap-5 rounded-sm bg-[#171714] px-5 py-3 text-sm text-white"
        >
          Try the complete form
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </Link>
        <p className="mt-4 text-[11px] text-[#68645d]">
          Made with Sumikami · Your demo answers aren’t saved.
        </p>
      </div>
      <div className="relative ml-8 mt-6 flex items-center gap-3">
        <span aria-hidden="true" className="h-px w-10 bg-current" />
        <p className="bg-background px-1 font-serif text-sm italic text-muted-foreground">
          A blank canvas. Your voice.
        </p>
      </div>
    </div>
  );
}
