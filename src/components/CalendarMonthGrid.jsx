import React from 'react';

function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year, month) {
    return new Date(year, month, 1).getDay(); // 0 (Sun) - 6 (Sat)
}

export default function CalendarMonthGrid({ year, month, renderDay, onPrevMonth, onNextMonth }) {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfWeek(year, month);
    const weeks = [];
    let day = 1 - firstDay;
    for (let w = 0; w < 6; w++) {
        const week = [];
        for (let d = 0; d < 7; d++, day++) {
            if (day < 1 || day > daysInMonth) {
                week.push(null);
            } else {
                week.push(day);
            }
        }
        weeks.push(week);
        if (day > daysInMonth) break;
    }
    const monthName = new Date(year, month).toLocaleString('default', { month: 'long' });
    return (
        <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <button onClick={onPrevMonth} style={{ fontSize: 18, background: 'none', border: 'none', cursor: 'pointer' }}>←</button>
                <span style={{ fontWeight: 700, fontSize: 18 }}>{monthName} {year}</span>
                <button onClick={onNextMonth} style={{ fontSize: 18, background: 'none', border: 'none', cursor: 'pointer' }}>→</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                <thead>
                    <tr style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                        <th>Sun</th><th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th><th>Sat</th>
                    </tr>
                </thead>
                <tbody>
                    {weeks.map((week, i) => (
                        <tr key={i}>
                            {week.map((date, j) => (
                                <td key={j} style={{ padding: 6, height: 36, verticalAlign: 'top' }}>
                                    {date ? renderDay(date) : ''}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
