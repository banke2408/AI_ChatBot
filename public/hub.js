/* PDACEK Student Success Hub — turns common student tasks into sourced chat requests. */
(() => {
  "use strict";

  const byId = (id) => document.getElementById(id);
  const value = (id) => byId(id)?.value.trim() || "";

  function ask(question) {
    window.dispatchEvent(new CustomEvent("pdacek:ask", { detail: { question } }));
  }

  function onSubmit(id, handler) {
    const form = byId(id);
    if (!form) return;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      handler();
    });
  }

  onSubmit("deadline-form", () => {
    const type = value("deadline-type");
    ask(`What is the latest official PDACEK ${type} deadline or notice? Give the exact date, who it applies to, and the official source. If the current index has no reliable deadline, say that clearly instead of guessing.`);
  });

  onSubmit("admission-form", () => {
    ask(`I am exploring PDACEK ${value("admission-program")} admission through ${value("admission-route")}. My current stage is: ${value("admission-stage")}. Create a concise official-first checklist for eligibility, documents, steps, and the right contact. Clearly mark anything that must be confirmed for the current year.`);
  });

  byId("fee-calculate")?.addEventListener("click", () => {
    const tuition = Number(value("fee-tuition")) || 0;
    const hostel = Number(value("fee-hostel")) || 0;
    const mess = (Number(value("fee-mess")) || 0) * 12;
    const other = Number(value("fee-other")) || 0;
    const total = tuition + hostel + mess + other;
    byId("fee-result").innerHTML = total
      ? `<strong>Estimated annual budget: ₹${total.toLocaleString("en-IN")}</strong><br><span>Includes ₹${mess.toLocaleString("en-IN")} mess estimate. Entered values are your own estimate—verify official fees below.</span>`
      : "Add at least one amount to calculate an estimate.";
  });

  byId("fee-verify")?.addEventListener("click", () => {
    ask("What is the latest official PDACEK fee structure? Separate the answer by admission route if the official source does so, include the academic year, and link the source. Do not estimate missing figures.");
  });

  onSubmit("exam-form", () => {
    const branch = value("exam-branch") || "my branch";
    const semester = value("exam-semester");
    ask(`Find the latest official PDACEK exam timetable, circular, or calendar relevant to ${branch}, ${semester} semester. State the examination/session, dates if present, and link the official source. If no matching timetable is indexed, explain the safest next official place to check.`);
  });

  byId("calendar-export")?.addEventListener("click", () => {
    const title = value("calendar-title");
    const dateValue = value("calendar-date");
    if (!title || !dateValue) {
      alert("Add your exam/reminder title and date first.");
      return;
    }

    const start = new Date(dateValue);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const formatDate = (date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    const escapeIcs = (text) => text.replace(/[\\,;]/g, "\\$&").replace(/\n/g, "\\n");
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//PDACEK//Student Success Hub//EN",
      "BEGIN:VEVENT", `UID:${Date.now()}@pdacek`, `DTSTAMP:${formatDate(new Date())}`,
      `DTSTART:${formatDate(start)}`, `DTEND:${formatDate(end)}`, `SUMMARY:${escapeIcs(title)}`,
      "DESCRIPTION:Reminder created in the PDACEK Student Success Hub. Confirm the official timetable before relying on this event.",
      "END:VEVENT", "END:VCALENDAR"
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "pdacek-reminder.ics";
    link.click();
    URL.revokeObjectURL(url);
  });

  onSubmit("academic-form", () => {
    const context = value("academic-context") || "my programme and semester";
    ask(`I need help with ${value("academic-issue")} at PDACEK (${context}). Explain the official next steps, requirements, likely deadline/checkpoints, and the source. Do not make assumptions about my marks or eligibility.`);
  });

  onSubmit("pdf-form", () => {
    const question = value("pdf-question");
    if (!question) return;
    ask(`Answer this using official PDACEK PDFs where possible: ${question}. Cite the PDF name and page number when the indexed source provides one. If the relevant PDF is not available, say so clearly.`);
  });

  onSubmit("notice-form", () => {
    const notice = value("notice-text");
    if (!notice) return;
    ask(`Explain this PDACEK notice in simple student-friendly language. Use these headings: What it means, Who needs to act, What to do next, Deadline/important date, and Official source. Notice: ${notice}`);
  });

  function handoffMessage() {
    const topic = value("handoff-topic");
    const name = value("handoff-name") || "[Your name]";
    const issue = value("handoff-issue") || "[Describe your question or issue]";
    return `Subject: Request for help — ${topic}\n\nHello PDACEK ${topic},\n\nMy name is ${name}. I need help with: ${issue}\n\nPlease let me know the next step or the required documents.\n\nThank you.`;
  }

  byId("handoff-copy")?.addEventListener("click", async () => {
    const status = byId("handoff-status");
    try {
      await navigator.clipboard.writeText(handoffMessage());
      status.textContent = "Your message was copied. Paste it into an official email or WhatsApp after confirming the contact.";
    } catch {
      status.textContent = "Copy is unavailable in this browser. Select the text below manually: " + handoffMessage();
    }
  });

  byId("handoff-find")?.addEventListener("click", () => {
    ask(`I need human help from the PDACEK ${value("handoff-topic")}. Give me the current official contact method, office/department name, and any office-hours information available from official sources. Do not invent a contact.`);
  });
})();
