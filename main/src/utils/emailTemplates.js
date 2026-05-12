function verificationEmailHtml({ firstName, verifyUrl }) {
  return `
    <h2>Verify your SylLab account</h2>
    <p>Hello ${firstName},</p>
    <p>Please verify your account before logging in.</p>
    <p><a href="${verifyUrl}">Verify email</a></p>
  `;
}

function passwordResetEmailHtml({ firstName, resetUrl }) {
  return `
    <h2>Reset your SylLab password</h2>
    <p>Hello ${firstName},</p>
    <p>Use this link to reset your password:</p>
    <p><a href="${resetUrl}">Reset password</a></p>
  `;
}

function submissionFlaggedEmailHtml({ firstName, riskLevel, assignmentTitle, ensembleScore, submissionId }) {
  return `
    <h2>SylLab ${riskLevel} submission alert</h2>
    <p>Hello ${firstName},</p>
    <p>A submission for <strong>${assignmentTitle}</strong> was flagged.</p>
    <p>Submission: ${submissionId}</p>
    <p>Ensemble score: ${ensembleScore}</p>
  `;
}

function interviewOutcomeEmailHtml({ firstName, outcome, assignmentTitle, notes }) {
  return `
    <h2>SylLab interview outcome</h2>
    <p>Hello ${firstName},</p>
    <p>Your interview outcome for <strong>${assignmentTitle}</strong>: ${outcome}</p>
    ${notes ? `<p>Notes: ${notes}</p>` : ""}
  `;
}

module.exports = {
  verificationEmailHtml,
  passwordResetEmailHtml,
  submissionFlaggedEmailHtml,
  interviewOutcomeEmailHtml,
};
