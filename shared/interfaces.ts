import {IGamePacket} from './interfaces/IGamePacket';
import {IResponsePacket} from './interfaces/IResponsePacket';
import {IWebSocketMessage} from './interfaces/IWebSocketMessage';
import {IPresetupAvailableInfoPacket} from './interfaces/IPresetupAvailableInfoPacket';
import {ITeam} from './interfaces/ITeam';
import {IRegisterMasterPacket} from './interfaces/IRegisterMasterPacket';
import {IBuzzer} from './interfaces/IBuzzer';
import {IQuestion} from './interfaces/IQuestion';
import {IMediaDetails} from './interfaces/IMediaDetails';
import {ISetupPacket} from './interfaces/ISetupPacket';
import {IAnswer} from './interfaces/IAnswer';
import {INewMasterAccepted} from './interfaces/INewMasterAccepted';
import {IGameState, CURRENT_SAVEGAME_VERSION} from './interfaces/IGameState';
import {IStartGamePacket} from './interfaces/IStartGamePacket';
import {ITeamSetPointsPacket} from './interfaces/ITeamSetPointsPacket';
import {IAnswerSetStatePacket} from './interfaces/IAnswerSetStatePacket';
import {ISetQuestionPacket} from './interfaces/ISetQuestionPacket';
import {IEndGamePacket} from './interfaces/IEndGamePacket';
import {IRegisterScreenPacket} from './interfaces/IRegisterScreenPacket';
import {IDataForScreenPacket} from './interfaces/IDataForScreenPacket';
import {IResetServerPacket} from './interfaces/IResetServerPacket';
import {IKeypressOnScreenPacket} from './interfaces/IKeypressOnScreenPacket';
import {IMarkTeamPacket} from './interfaces/IMarkTeamPacket';
import {ISetBuzzerLockPacket} from './interfaces/ISetBuzzerLockPacket';
import {IUpdateMediaStatePacket} from './interfaces/IUpdateMediaStatePacket';
import {IDirectoryTree} from './interfaces/IDirectoryTree';
export * from './interfaces/IWebsocket';

export {
	IDirectoryTree,
	IGamePacket,
	IResponsePacket,
	IWebSocketMessage,
	IPresetupAvailableInfoPacket,
	ITeam,
	IRegisterMasterPacket,
	IBuzzer,
	IQuestion,
	IMediaDetails,
	IUpdateMediaStatePacket,
	ISetupPacket,
	IAnswer,
	INewMasterAccepted,
	IGameState,
	IStartGamePacket,
	ITeamSetPointsPacket,
	IAnswerSetStatePacket,
	ISetQuestionPacket,
	IEndGamePacket,
	IRegisterScreenPacket,
	IDataForScreenPacket,
	IResetServerPacket,
	IKeypressOnScreenPacket,
	IMarkTeamPacket,
	CURRENT_SAVEGAME_VERSION,
	ISetBuzzerLockPacket
}
