import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const MedChainAuditModule = buildModule("MedChainAuditModule", (m) => {
  const audit = m.contract("MedChainAudit", []);

  return { audit };
});

export default MedChainAuditModule;
