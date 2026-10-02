-- Base falsa que imita el ERP Saint, solo para desarrollo y pruebas de sincronización.
-- Crea SaintDemo con SAPROD, SALOTE y MarcasCopia. Nunca se usa en producción:
-- ahí ERP_DB apunta a la base real del ERP, ya existente en el mismo servidor.

IF DB_ID('SaintDemo') IS NULL
BEGIN
  CREATE DATABASE SaintDemo;
END
GO

USE SaintDemo;
GO

IF OBJECT_ID('dbo.SAPROD') IS NOT NULL DROP TABLE dbo.SAPROD;
IF OBJECT_ID('dbo.SALOTE') IS NOT NULL DROP TABLE dbo.SALOTE;
IF OBJECT_ID('dbo.MarcasCopia') IS NOT NULL DROP TABLE dbo.MarcasCopia;
GO

CREATE TABLE dbo.MarcasCopia (
  CodInst            VARCHAR(10) NOT NULL PRIMARY KEY,
  DescripcionMarca   VARCHAR(100) NOT NULL
);

CREATE TABLE dbo.SAPROD (
  CodProd  VARCHAR(40)  NOT NULL PRIMARY KEY,
  Descrip  VARCHAR(250) NULL,
  Refere   VARCHAR(100) NULL,
  CodInst  VARCHAR(10)  NULL
);

CREATE TABLE dbo.SALOTE (
  CodProd  VARCHAR(40)  NOT NULL,
  NroLote  VARCHAR(60)  NOT NULL,
  FechaV   DATE         NULL
);
GO

INSERT INTO dbo.MarcasCopia (CodInst, DescripcionMarca) VALUES
  ('OSRP', 'Osteosíntesis RP'),
  ('MAXF', 'MaxFacial Implants'),
  ('DENT', 'DentalPro'),
  ('ORTO', 'Ortopedia Andina');

INSERT INTO dbo.SAPROD (CodProd, Descrip, Refere, CodInst) VALUES
  ('136022', 'Tornillo de titanio 2.0x10mm',        'TI-2010',  'OSRP'),
  ('136023', 'Tornillo de titanio 2.0x12mm',        'TI-2012',  'OSRP'),
  ('140011', 'Placa de reconstrucción mandibular',  'PRM-01',   'MAXF'),
  ('140012', 'Placa recta 4 huecos',                'PR4-04',   'MAXF'),
  ('150030', 'Miniplaca en L',                      'ML-07',    'MAXF'),
  ('160045', 'Kit de fresas quirúrgicas',           'KFQ-03',   'ORTO'),
  ('170022', 'Membrana de colágeno',                'MC-15',    'DENT'),
  ('170023', 'Hueso liofilizado 0.5cc',              'HL-05',    'DENT'),
  ('180010', 'Sutura reabsorbible 4-0',             'SR-40',    'DENT'),
  ('190001', 'Implante dental 4.0x10mm',            'IMP-410',  'DENT'),
  ('999999', 'Producto sin lote de ejemplo',        'SL-01',    'ORTO');

-- 136022: varios lotes, incluido uno repetido (dos filas del mismo lote, distinta vigencia de registro)
INSERT INTO dbo.SALOTE (CodProd, NroLote, FechaV) VALUES
  ('136022', '01599-9',   '2027-06-30'),
  ('136022', '01599-9',   '2027-06-30'),   -- fila duplicada a propósito (ver 4.4 de la especificación)
  ('136022', '24084133',  '2026-12-01'),
  ('136023', '01601-2',   '2027-03-15'),
  ('140011', 'a12572',    '2028-01-10'),   -- lote en minúsculas a propósito
  ('140012', 'A12580',    '2028-02-20'),
  ('150030', 'ML0099',    '2027-09-05'),
  ('160045', 'KF2201',    NULL),
  ('170022', 'MC3301',    '2026-11-30'),
  ('170023', 'HL4401',    '2026-10-15'),
  ('180010', 'SR5501',    '2027-01-01'),
  ('190001', 'IM6601',    '2028-05-01'),
  ('190001', 'IM6602',    '2028-06-01');
GO
