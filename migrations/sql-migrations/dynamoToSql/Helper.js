class Helper {
  constructor(sqlClient) {
    this.sqlClient = sqlClient;
  }

  sqlInsert = async (sqlObject, tableName, extraLoggingData = {}) => {
    try {
      await sqlClient(tableName).insert(sqlObject);
    } catch (e) {
      throw new Error(
        `
        ----------------------
        -------------------
        Error inserting this object in ${tableName}:
        sqlObject: ${JSON.stringify(sqlObject)}
        -------------------
        Original Error: ${e}
        -------------------
        ----------------------
        extraLoggingData: ${JSON.stringify(extraLoggingData)}
        `
      );
    }
  }

  sampleFileTypeDynamoToEnum = {
    'features.tsv.gz': 'features10x',
    'barcodes.tsv.gz': 'barcodes10x',
    'matrix.mtx.gz': 'matrix10x',
  }
  
  sqlInsertExperiment = async (experimentId, projectData, experimentData) => {
    const sqlExperiment = {
      id: experimentId,
      name: projectData.name,
      description: projectData.description,
      processing_config: experimentData.processingConfig,
      created_at: projectData.createdDate,
      updated_at: projectData.lastModified,
      notify_by_email: experimentData.notifyByEmail,
    };
  
    await this.sqlInsert(sqlExperiment, 'experiment', { experimentId, projectData });
  }
  
  sqlInsertExperimentExecutionGem2s = async (experimentId, experimentData) => {
    const { paramsHash, stateMachineArn, executionArn } = experimentData.meta.gem2s;
  
    const sqlExperimentExecution = {
      experiment_id: experimentId,
      pipeline_type: 'gem2s',
      params_hash: paramsHash,
      state_machine_arn: stateMachineArn,
      execution_arn: executionArn,
    };
  
    await this.sqlInsert(sqlExperimentExecution, 'experiment_execution', { experimentId, experimentData });
  };
  
  sqlInsertExperimentExecutionQC = async (experimentId, experimentData) => {
    const { stateMachineArn, executionArn } = experimentData.meta.pipeline;
  
    const sqlExperimentExecution = {
      experiment_id: experimentId,
      pipeline_type: 'qc',
      // QC doesn't have paramsHash (it isn't needed)
      params_hash: null,
      state_machine_arn: stateMachineArn,
      execution_arn: executionArn,
    };
  
    await this.sqlInsert(sqlExperimentExecution, 'experiment_execution', { experimentId, experimentData });
  };
  
  sqlInsertSample = async (experimentId, sample) => {
    const sqlSample = {
      id: sample.uuid,
      experiment_id: experimentId,
      name: sample.name,
      sample_technology: '10x',
      created_at: sample.createdDate,
      updated_at: sample.lastModified,
    };
    
    await this.sqlInsert(sqlSample, 'sample');
  };
  
  sqlInsertSampleFile = async (sampleFileUuid, projectUuid, sample, fileName, file) => {
    const sampleFileTypeEnumKey = this.sampleFileTypeDynamoToEnum[fileName];

    const s3Path = `${projectUuid}/${sample.uuid}/${fileName}`;

    // If the file size is not saved (there's some functional experiments in this state)
    // then set a negative value that we can recognize and let it go on
    const fileSize = file.size || -1;

    // SQL "sample_file" table
    const sqlSampleFile = {
      id: sampleFileUuid,
      sample_file_type: sampleFileTypeEnumKey,
      valid: file.valid,
      size: fileSize,
      s3_path: s3Path,
      upload_status: file.upload.status,
      updated_at: file.lastModified
    };

    await this.sqlInsert(sqlSampleFile, 'sample_file', { projectUuid, sample, file });
  };
  
  sqlInsertSampleToSampleFileMap = async (sampleFileUuid, sample) => {
    const sqlSampleToSampleFile = {
      sample_id: sample.uuid,
      sample_file_id: sampleFileUuid,
    }
    
    await this.sqlInsert(sqlSampleToSampleFile, 'sample_to_sample_file_map', { sample });
  }
  
  sqlInsertMetadataTrack = async (metadataTrack, experimentId) => {
    const sqlMetadataTrack = {
      key: metadataTrack,
      experiment_id: experimentId,
    }
  
    await this.sqlInsert(sqlMetadataTrack, 'metadata_track');
  }
  
  sqlInsertSampleInMetadataTrackMap = async (experimentId, metadataTrack, sample) => {
    const sqlSampleInMetadataTrackMap = {
      metadata_track_key: metadataTrack,
      experiment_id: experimentId,
      sample_id: sample.uuid,
      value: sample.metadata[metadataTrack],
    };
  
    await this.sqlInsert(sqlSampleInMetadataTrackMap, 'sample_in_metadata_track_map', { sample });
  }
};

module.exports = Helper;