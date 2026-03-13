export default function DocPreviewModal({ doc, client, onClose }) {
    if (!doc || !client) return null;
    const p = doc.preview;

    // Determine which preview layout to show
    const isITR = doc.type?.startsWith('ITR');
    const isGST = doc.type?.startsWith('GST') || doc.type === 'GSTR-3B' || doc.type === 'GSTR-1' || doc.type === 'GSTR-9';
    const isForm16 = doc.type === 'Form 16';
    const is26AS = doc.type === 'Form 26AS';
    const isTDS = doc.type?.startsWith('TDS');
    const isCapGain = doc.type === 'Capital Gains Statement';

    return (
        <div
            style={{
                display: 'flex', position: 'fixed', inset: 0, zIndex: 300,
                background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
                alignItems: 'center', justifyContent: 'center', padding: '20px'
            }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div style={{
                background: '#0f1629', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '20px', width: '100%', maxWidth: '620px',
                maxHeight: '85vh', overflowY: 'auto', position: 'relative',
                boxShadow: '0 24px 64px rgba(0,0,0,0.6)'
            }}>
                {/* Header */}
                <div style={{
                    padding: '24px 28px 20px',
                    borderBottom: '1px solid rgba(255,255,255,0.07)',
                    display: 'flex', alignItems: 'flex-start', gap: '14px'
                }}>
                    <div style={{
                        fontSize: '32px', width: '52px', height: '52px',
                        background: 'rgba(99,102,241,0.15)', borderRadius: '14px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                        {doc.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '17px', fontWeight: 700, marginBottom: '4px' }}>{p.title}</div>
                        <div style={{ fontSize: '13px', color: '#94a3b8' }}>{doc.name} &nbsp;•&nbsp; {doc.size}</div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '22px', cursor: 'pointer', padding: '4px', flexShrink: 0 }}
                    >✕</button>
                </div>

                {/* Document Body */}
                <div style={{ padding: '24px 28px' }}>
                    {/* Client Strip */}
                    <div style={{
                        background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
                        borderRadius: '12px', padding: '14px 18px', marginBottom: '20px',
                        display: 'flex', flexWrap: 'wrap', gap: '18px'
                    }}>
                        <InfoPill label="Client" value={client.name} />
                        <InfoPill label="PAN" value={client.pan} mono />
                        {p.ay && <InfoPill label={p.period ? 'Period' : 'Assess. Year'} value={p.ay || p.period} />}
                        {p.gstin && <InfoPill label="GSTIN" value={p.gstin} mono />}
                    </div>

                    {/* Dynamic preview rows */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                        {isITR && <ITRPreview p={p} />}
                        {isGST && <GSTPreview p={p} doc={doc} />}
                        {isForm16 && <Form16Preview p={p} />}
                        {is26AS && <Stmt26ASPreview p={p} />}
                        {isTDS && <TDSPreview p={p} />}
                        {isCapGain && <CapGainPreview p={p} />}
                    </div>

                    {/* Status Banner */}
                    <StatusBanner status={p.status} />
                </div>
            </div>
        </div>
    );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InfoPill({ label, value, mono }) {
    return (
        <div>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
            <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '2px', fontFamily: mono ? 'monospace' : 'inherit' }}>{value}</div>
        </div>
    );
}

function Row({ label, value, highlight, color }) {
    return (
        <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '13px 0', borderBottom: '1px solid rgba(255,255,255,0.05)'
        }}>
            <span style={{ fontSize: '13px', color: '#94a3b8' }}>{label}</span>
            <span style={{
                fontSize: '14px', fontWeight: highlight ? 700 : 500,
                color: color || (highlight ? '#a5b4fc' : '#f1f5f9')
            }}>{value}</span>
        </div>
    );
}

function StatusBanner({ status }) {
    if (!status) return null;
    const filed = status.toLowerCase().includes('filed') || status.toLowerCase().includes('active') || status.toLowerCase().includes('verified');
    const pending = status.toLowerCase().includes('pending') || status.toLowerCase().includes('draft');
    const review = status.toLowerCase().includes('review');
    const color = filed
        ? { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', text: '#6ee7b7', icon: '✅' }
        : pending
            ? { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', text: '#fcd34d', icon: '⏳' }
            : { bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.3)', text: '#a5b4fc', icon: '🔄' };
    return (
        <div style={{
            marginTop: '20px', background: color.bg, border: `1px solid ${color.border}`,
            borderRadius: '10px', padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: '10px'
        }}>
            <span style={{ fontSize: '18px' }}>{color.icon}</span>
            <div>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>CURRENT STATUS</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: color.text }}>{status}</div>
            </div>
        </div>
    );
}

function ITRPreview({ p }) {
    return (
        <>
            <Row label="Gross Total Income" value={p.income} highlight />
            <Row label="Total Tax Paid / TDS" value={p.taxPaid} />
            <Row label="Refund / Tax Payable" value={p.refund} color={p.refund === '₹0' ? '#94a3b8' : '#6ee7b7'} />
            {p.ackNo !== '—' && <Row label="Acknowledgement No." value={p.ackNo} />}
            <Row label="Date of Filing" value={p.filedOn} />
        </>
    );
}

function GSTPreview({ p, doc }) {
    return (
        <>
            {p.totalInvoices && <Row label="Total Invoices" value={p.totalInvoices} />}
            {p.totalTaxableValue && <Row label="Total Taxable Value" value={p.totalTaxableValue} highlight />}
            {p.totalTurn && <Row label="Total Turnover" value={p.totalTurnover} highlight />}
            <Row label="Total GST" value={p.totalTax} highlight />
            {p.igst && <Row label="IGST" value={p.igst} />}
            {p.cgst && <Row label="CGST" value={p.cgst} />}
            {p.sgst && <Row label="SGST" value={p.sgst} />}
            {p.dueDate && <Row label="Due Date" value={p.dueDate} color="#fcd34d" />}
            {p.filedOn && <Row label="Filed On" value={p.filedOn} />}
            {p.ackNo && <Row label="Ack. No." value={p.ackNo} />}
        </>
    );
}

function Form16Preview({ p }) {
    return (
        <>
            <Row label="Employer" value={p.employer} />
            <Row label="Gross Salary" value={p.grossSalary} highlight />
            <Row label="TDS Deducted" value={p.tdsDeducted} />
            <Row label="TAN No." value={p.tanNo} />
            <Row label="Issued On" value={p.issuedOn} />
        </>
    );
}

function Stmt26ASPreview({ p }) {
    return (
        <>
            <Row label="Total TDS Deducted" value={p.totalTDSDeducted} highlight />
            <Row label="Advance Tax Paid" value={p.advanceTax} />
            <Row label="Refund Claimed" value={p.refundClaimed} />
            <Row label="Generated On" value={p.generatedOn} />
        </>
    );
}

function TDSPreview({ p }) {
    return (
        <>
            {p.deductor && <Row label="Deductor" value={p.deductor} />}
            {p.nature && <Row label="Nature of Payment" value={p.nature} />}
            {p.totalDeductees && <Row label="Total Deductees" value={p.totalDeductees} />}
            {p.totalTDSDeducted && <Row label="Total TDS" value={p.totalTDSDeducted} highlight />}
            {p.tdsDeducted && <Row label="TDS Deducted" value={p.tdsDeducted} highlight />}
            {p.tanNo && <Row label="TAN No." value={p.tanNo} />}
            {p.dueDate && <Row label="Due Date" value={p.dueDate} color="#fcd34d" />}
            {p.issuedOn && <Row label="Issued On" value={p.issuedOn} />}
        </>
    );
}

function CapGainPreview({ p }) {
    return (
        <>
            <Row label="Short-Term Gains (STCG)" value={p.stcg} />
            <Row label="Long-Term Gains (LTCG)" value={p.ltcg} />
            <Row label="Total Capital Gains" value={p.totalGains} highlight />
            <Row label="Tax on STCG (15%)" value={p.taxOnSTCG} />
            <Row label="Tax on LTCG (10%)" value={p.taxOnLTCG} />
            <Row label="Prepared On" value={p.preparedOn} />
        </>
    );
}
