import React from 'react';
import QuoteDocument from './QuoteDocument';
import QuotationActions from './QuotationActions';
import { StepIntro } from './fields';

export default function ReviewStep({ quote, company, onSendEmail, homeState, registrationDraft }) {
  return (
    <div className="space-y-4">
      <StepIntro
        title="Review & Kirim"
        subtitle="Periksa dokumen price list Anda, lalu pilih salah satu opsi di bawah."
      />
      <QuoteDocument quote={quote} company={company} />
      <QuotationActions
        quote={quote}
        company={company}
        onSendEmail={onSendEmail}
        homeState={homeState}
        registrationDraft={registrationDraft}
      />
    </div>
  );
}
